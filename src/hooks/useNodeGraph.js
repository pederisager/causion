import { useEffect, useMemo, useRef } from "react";
import {
  MarkerType,
  useEdgesState,
  useNodesState,
} from "reactflow";
import { applyNodeData } from "../utils/nodeUtils.js";
import { applyEdgeVisualState } from "../utils/edgeUtils.js";
import { deriveEffectLabel } from "../utils/effectLabels.js";
import {
  NODE_HEIGHT,
  NODE_SEPARATION,
  NODE_WIDTH,
  RANK_SEPARATION,
} from "../components/constants.js";

const NODE_W = NODE_WIDTH;
const NODE_H = NODE_HEIGHT;
const RANK_SEP = RANK_SEPARATION;
const NODE_SEP = NODE_SEPARATION;
const BASE_SPACING = NODE_H + NODE_SEP;

function layoutLeftRight(eqs, allVars) {
  const nodeIds = new Set(allVars ?? []);
  for (const [child, parents] of eqs) {
    nodeIds.add(child);
    for (const parent of parents ?? []) {
      nodeIds.add(parent);
    }
  }

  if (nodeIds.size === 0) {
    return {};
  }

  const parentMap = new Map();
  const childMap = new Map();
  for (const id of nodeIds) {
    parentMap.set(id, new Set());
    childMap.set(id, new Set());
  }

  for (const [child, parentsRaw] of eqs) {
    const parents = parentsRaw ? [...parentsRaw] : [];
    const bucket = parentMap.get(child);
    for (const parent of parents) {
      bucket.add(parent);
      childMap.get(parent)?.add(child);
    }
  }

  const order = topoSortSafe(parentMap, childMap, nodeIds);
  const rank = new Map();
  for (const id of order) {
    const parents = parentMap.get(id) ?? new Set();
    if (!parents.size) {
      rank.set(id, 0);
      continue;
    }
    let current = 0;
    for (const parent of parents) {
      current = Math.max(current, (rank.get(parent) ?? 0) + 1);
    }
    rank.set(id, current);
  }

  const rankBuckets = new Map();
  const topoIndex = new Map(order.map((id, index) => [id, index]));
  for (const id of order) {
    const r = rank.get(id) ?? 0;
    if (!rankBuckets.has(r)) {
      rankBuckets.set(r, []);
    }
    rankBuckets.get(r).push(id);
  }

  const sortedRanks = [...rankBuckets.keys()].sort((a, b) => a - b);
  const layers = sortedRanks.map((r) =>
    rankBuckets.get(r).sort((a, b) => (topoIndex.get(a) ?? 0) - (topoIndex.get(b) ?? 0))
  );

  const barycenterSort = (layer, neighborLayer, accessNeighbors) => {
    if (!neighborLayer) return;
    const neighborOrder = new Map(
      neighborLayer.map((id, index) => [id, index])
    );
    layer.sort((a, b) => {
      const weightA = computeBarycenter(accessNeighbors(a), neighborOrder, topoIndex.get(a) ?? 0);
      const weightB = computeBarycenter(accessNeighbors(b), neighborOrder, topoIndex.get(b) ?? 0);
      if (weightA === weightB) {
        return (topoIndex.get(a) ?? 0) - (topoIndex.get(b) ?? 0) || (a < b ? -1 : a > b ? 1 : 0);
      }
      return weightA - weightB;
    });
  };

  for (let i = 1; i < layers.length; i += 1) {
    const layer = layers[i];
    const prev = layers[i - 1];
    barycenterSort(layer, prev, (id) => parentMap.get(id) ?? new Set());
  }

  for (let i = layers.length - 2; i >= 0; i -= 1) {
    const layer = layers[i];
    const next = layers[i + 1];
    barycenterSort(layer, next, (id) => childMap.get(id) ?? new Set());
  }

  let maxRows = 0;
  for (const layer of layers) {
    maxRows = Math.max(maxRows, layer.length);
  }

  const xForRank = (r) => 50 + r * (NODE_W + RANK_SEP);
  const pos = {};
  const globalHeight = maxRows ? maxRows * BASE_SPACING - NODE_SEP : 0;
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    const totalH = layer.length ? layer.length * BASE_SPACING - NODE_SEP : 0;
    const baseY = layer.length
      ? Math.max(50, 50 + (globalHeight - totalH) / 2)
      : 50;
    layer.forEach((id, index) => {
      pos[id] = { x: xForRank(i), y: baseY + index * BASE_SPACING };
    });
  }

  const centersInitial = new Map();
  for (const id of order) {
    const base = pos[id]?.y ?? 50;
    centersInitial.set(id, base + NODE_H / 2);
  }

  const rankOf = (id) => rank.get(id) ?? 0;
  const average = (values) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;

  let centers = centersInitial;
  const iterations = 3;
  for (let pass = 0; pass < iterations; pass += 1) {
    const nextCenters = new Map(centers);

    for (const id of order) {
      const current = centers.get(id) ?? (50 + NODE_H / 2);
      const parents = [...(parentMap.get(id) ?? [])].filter((p) => centers.has(p));
      const children = [...(childMap.get(id) ?? [])].filter((c) => centers.has(c));
      const parentCenters = parents.map((p) => centers.get(p)).filter(Number.isFinite);
      const childCenters = children.map((c) => centers.get(c)).filter(Number.isFinite);

      let desired = current;

      const avgParents = average(parentCenters);
      const avgChildren = average(childCenters);

      if (Number.isFinite(avgParents) && Number.isFinite(avgChildren)) {
        desired = (avgParents + avgChildren) / 2;
      } else if (Number.isFinite(avgParents)) {
        desired = avgParents;
      } else if (Number.isFinite(avgChildren)) {
        desired = avgChildren;
      }

      if (!parentCenters.length && childCenters.length) {
        const gaps = children
          .map((child) => (rankOf(child) - rankOf(id)))
          .filter((gap) => gap > 1);
        if (gaps.length) {
          const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
          desired -= BASE_SPACING * Math.min(Math.max(avgGap - 1, 0), 2) * 0.7;
        }
      }

      if (!childCenters.length && parentCenters.length) {
        const gaps = parents
          .map((parent) => (rankOf(id) - rankOf(parent)))
          .filter((gap) => gap > 1);
        if (gaps.length) {
          const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
          desired += BASE_SPACING * Math.min(Math.max(avgGap - 1, 0), 2) * 0.7;
        }
      }

      const blended = current * 0.4 + desired * 0.6;
      nextCenters.set(id, blended);
    }

    for (let i = 0; i < layers.length; i += 1) {
      const layer = layers[i];
      if (layer.length <= 1) continue;
      let prevCenter = nextCenters.get(layer[0]) ?? (50 + NODE_H / 2);
      nextCenters.set(layer[0], prevCenter);
      for (let index = 1; index < layer.length; index += 1) {
        const id = layer[index];
        const current = nextCenters.get(id) ?? prevCenter + BASE_SPACING;
        const minAllowed = prevCenter + BASE_SPACING;
        const adjusted = current < minAllowed ? minAllowed : current;
        nextCenters.set(id, adjusted);
        prevCenter = adjusted;
      }

      let nextCenter = nextCenters.get(layer[layer.length - 1]) ?? prevCenter;
      for (let index = layer.length - 2; index >= 0; index -= 1) {
        const id = layer[index];
        const current = nextCenters.get(id) ?? nextCenter - BASE_SPACING;
        const maxAllowed = nextCenter - BASE_SPACING;
        const adjusted = current > maxAllowed ? maxAllowed : current;
        nextCenters.set(id, adjusted);
        nextCenter = adjusted;
      }
    }

    centers = nextCenters;
  }

  let minCenter = Infinity;
  for (const center of centers.values()) {
    if (Number.isFinite(center)) {
      minCenter = Math.min(minCenter, center);
    }
  }

  const offset = Number.isFinite(minCenter) ? Math.max(0, 50 + NODE_H / 2 - minCenter) : 0;

  for (const id of order) {
    const adjustedCenter = (centers.get(id) ?? (50 + NODE_H / 2)) + offset;
    pos[id] = {
      ...pos[id],
      y: Math.max(50, adjustedCenter - NODE_H / 2),
    };
  }

  return pos;
}

function computeBarycenter(neighbors, neighborOrder, fallback) {
  const values = [];
  for (const neighbor of neighbors || []) {
    if (neighborOrder.has(neighbor)) {
      values.push(neighborOrder.get(neighbor));
    }
  }
  if (!values.length) return fallback;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function topoSortSafe(parentMap, childMap, nodeIds) {
  try {
    const indegree = new Map();
    const pending = [...nodeIds].sort();
    for (const id of pending) {
      indegree.set(id, (parentMap.get(id) ?? new Set()).size);
    }

    const queue = pending
      .filter((id) => (indegree.get(id) ?? 0) === 0)
      .sort();

    const order = [];
    while (queue.length) {
      const node = queue.shift();
      order.push(node);
      const children = childMap.get(node);
      if (!children) continue;
      for (const child of children) {
        indegree.set(child, (indegree.get(child) ?? 1) - 1);
        if (indegree.get(child) === 0) {
          queue.push(child);
        }
      }
      queue.sort();
    }

    if (order.length !== nodeIds.size) {
      throw new Error("cycle detected");
    }

    return order;
  } catch {
    return [...nodeIds].sort();
  }
}

function pickHandleFromDelta(dx, dy) {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx >= ady) return dx >= 0 ? "R" : "L";
  return dy >= 0 ? "B" : "T";
}

function nodeCenter(node) {
  return {
    x: node.position.x + NODE_W / 2,
    y: node.position.y + NODE_H / 2,
  };
}

function mapHandleId(code, kind) {
  switch (code) {
    case "T":
      return `T_${kind}`;
    case "R":
      return `R_${kind}`;
    case "B":
      return `B_${kind}`;
    case "L":
      return `L_${kind}`;
    default:
      return undefined;
  }
}

export function useNodeGraph({
  eqs,
  allVars,
  features,
  model,
  displayValues,
  ranges,
  interventions,
  edgeHot,
  graphSignature,
  reactFlow,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodesRef = useRef([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const nodePositionSignature = useMemo(
    () =>
      nodes
        .map((node) => `${node.id}:${node.position?.x ?? 0}:${node.position?.y ?? 0}`)
        .sort()
        .join("|"),
    [nodes]
  );

  useEffect(() => {
    if (eqs.size === 0) {
      setNodes([]);
      return;
    }

    const ids = [...allVars];
    const positions = features.layoutFreeform ? null : layoutLeftRight(eqs, allVars);

    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      let mutated = prev.length !== ids.length;
      const next = ids.map((id, index) => {
        const prevNode = prevMap.get(id);
        const fallbackPos = { x: 120 + index * 160, y: 160 + index * 40 };
        const desiredPosition =
          (features.layoutFreeform && prevNode ? prevNode.position : undefined) ||
          positions?.[id] ||
          prevNode?.position ||
          fallbackPos;

        if (prevNode) {
          let node = prevNode;
          if (prevNode.type !== "circle" || prevNode.draggable !== true) {
            node = { ...node, type: "circle", draggable: true };
            mutated = true;
          }
          if (
            !prevNode.position ||
            prevNode.position.x !== desiredPosition.x ||
            prevNode.position.y !== desiredPosition.y
          ) {
            node = { ...node, position: desiredPosition };
            mutated = true;
          }
          if (!node.data) {
            node = {
              ...node,
              data: { id, value: 0, min: -100, max: 100, stylePreset: features.stylePreset },
            };
            mutated = true;
          } else if (node.data.stylePreset !== features.stylePreset) {
            node = {
              ...node,
              data: { ...node.data, stylePreset: features.stylePreset },
            };
            mutated = true;
          }
          return node;
        }

        mutated = true;
        return {
          id,
          type: "circle",
          position: desiredPosition,
          data: { id, value: 0, min: -100, max: 100, stylePreset: features.stylePreset },
          draggable: true,
        };
      });
      return mutated ? next : prev;
    });
  }, [eqs, allVars, features.layoutFreeform, features.stylePreset, setNodes]);

  useEffect(() => {
    setNodes((prev) => applyNodeData(prev, displayValues, ranges, features.stylePreset, interventions));
  }, [displayValues, ranges, features.stylePreset, interventions, setNodes]);

  const baseEdgeType = features.causalFlow
    ? "causal"
    : features.edgeStraightening
    ? "straight"
    : undefined;

  useEffect(() => {
    if (eqs.size === 0) {
      setEdges([]);
      return;
    }

    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));

    setEdges((prev) => {
      const prevMap = new Map(prev.map((e) => [e.id, e]));
      let mutated = false;
      const next = [];

      for (const [child, parents] of eqs) {
        const targetNode = nodeMap.get(child);
        if (!targetNode) continue;
        const targetCenter = nodeCenter(targetNode);
        for (const parent of parents) {
          const sourceNode = nodeMap.get(parent);
          if (!sourceNode) continue;
          const sourceCenter = nodeCenter(sourceNode);
          const dx = targetCenter.x - sourceCenter.x;
          const dy = targetCenter.y - sourceCenter.y;
          const sourceHandle = features.anchorHandles ? mapHandleId(pickHandleFromDelta(dx, dy), "s") : undefined;
          const targetHandle = features.anchorHandles ? mapHandleId(pickHandleFromDelta(-dx, -dy), "t") : undefined;
          const id = `${parent}->${child}`;
          const desiredMarker = { type: MarkerType.ArrowClosed, width: 30, height: 30, color: "#111" };
          const desiredStyle = { strokeWidth: 2, stroke: "#111" };
          const rawLabel = features.edgeEffectLabels && model ? deriveEffectLabel(model, parent, child) : "";
          const trimmedLabel = typeof rawLabel === "string" ? rawLabel.trim() : "";
          const prevEdge = prevMap.get(id);
          if (prevEdge) {
            let edge = prevEdge;
            if (
              prevEdge.source !== parent ||
              prevEdge.target !== child ||
              prevEdge.sourceHandle !== sourceHandle ||
              prevEdge.targetHandle !== targetHandle ||
              prevEdge.type !== baseEdgeType ||
              prevEdge.markerEnd?.type !== desiredMarker.type ||
              prevEdge.markerEnd?.color !== desiredMarker.color ||
              prevEdge.markerEnd?.width !== desiredMarker.width ||
              prevEdge.markerEnd?.height !== desiredMarker.height
            ) {
              edge = {
                ...edge,
                source: parent,
                target: child,
                sourceHandle,
                targetHandle,
                type: baseEdgeType,
                markerEnd: desiredMarker,
              };
              mutated = true;
            }
            if (!edge.style || edge.style.stroke !== desiredStyle.stroke || edge.style.strokeWidth !== desiredStyle.strokeWidth) {
              edge = { ...edge, style: desiredStyle };
              mutated = true;
            }
            if (!edge.data) {
              const nextData = {
                hot: false,
                pulseMs: features.flowPulseMs,
                stylePreset: features.stylePreset,
                disabledByDo: !!interventions?.[child],
              };
              if (trimmedLabel) {
                nextData.effectLabel = trimmedLabel;
              }
              edge = { ...edge, data: nextData };
              mutated = true;
            } else {
              const nextData = {
                ...edge.data,
                pulseMs: features.flowPulseMs,
                stylePreset: features.stylePreset,
                disabledByDo: !!interventions?.[child],
              };
              if (trimmedLabel) {
                nextData.effectLabel = trimmedLabel;
              } else if (nextData.effectLabel) {
                delete nextData.effectLabel;
              }
              if (
                edge.data.pulseMs !== nextData.pulseMs ||
                edge.data.stylePreset !== nextData.stylePreset ||
                edge.data.effectLabel !== nextData.effectLabel ||
                edge.data.disabledByDo !== nextData.disabledByDo
              ) {
                edge = { ...edge, data: nextData };
                mutated = true;
              }
            }
            next.push(edge);
          } else {
            mutated = true;
            next.push({
              id,
              source: parent,
              target: child,
              sourceHandle,
              targetHandle,
              type: baseEdgeType,
              data: {
                hot: false,
                pulseMs: features.flowPulseMs,
                stylePreset: features.stylePreset,
                disabledByDo: !!interventions?.[child],
                ...(trimmedLabel ? { effectLabel: trimmedLabel } : {}),
              },
              style: desiredStyle,
              markerEnd: desiredMarker,
            });
          }
        }
      }

      if (!mutated && next.length !== prev.length) mutated = true;
      return mutated ? next : prev;
    });
  }, [eqs, features.anchorHandles, baseEdgeType, nodePositionSignature, setEdges, features.flowPulseMs, features.stylePreset, features.edgeEffectLabels, model, interventions]);

  useEffect(() => {
    setEdges((prev) =>
      applyEdgeVisualState(prev, edgeHot, {
        causalFlow: features.causalFlow,
        flowPulseMs: features.flowPulseMs,
        edgeStraightening: features.edgeStraightening,
        stylePreset: features.stylePreset,
      })
    );
  }, [edgeHot, features.causalFlow, features.flowPulseMs, features.edgeStraightening, features.stylePreset, setEdges]);

  useEffect(() => {
    if (!reactFlow) return;
    if (!nodes.length) return;
    reactFlow.fitView({ padding: 0.12, duration: 350 });
  }, [reactFlow, nodes.length, graphSignature, features.layoutFreeform]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
  };
}

export const __TEST_ONLY__ = {
  layoutLeftRight,
};

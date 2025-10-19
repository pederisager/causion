import { useEffect, useMemo, useRef } from "react";
import {
  MarkerType,
  useEdgesState,
  useNodesState,
} from "reactflow";
import { applyNodeData } from "../utils/nodeUtils.js";
import { applyEdgeVisualState } from "../utils/edgeUtils.js";
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

function layoutLeftRight(eqs) {
  const order = topoSortSafe(eqs);
  const rank = {};
  for (const id of order) {
    const parents = [...(eqs.get(id) || [])];
    rank[id] = parents.length
      ? Math.max(...parents.map((p) => rank[p] || 0)) + 1
      : 0;
  }

  const buckets = new Map();
  for (const id of order) {
    const r = rank[id];
    if (!buckets.has(r)) buckets.set(r, []);
    buckets.get(r).push(id);
  }

  let maxRows = 0;
  for (const arr of buckets.values()) {
    maxRows = Math.max(maxRows, arr.length);
  }

  const xForRank = (r) => 50 + r * (NODE_W + RANK_SEP);
  const pos = {};
  for (const [r, arr] of buckets) {
    const totalH = arr.length * (NODE_H + NODE_SEP) - NODE_SEP;
    const startY = Math.max(50, (maxRows * (NODE_H + NODE_SEP) - NODE_SEP - totalH) / 2 + 50);
    arr.forEach((id, i) => {
      pos[id] = { x: xForRank(r), y: startY + i * (NODE_H + NODE_SEP) };
    });
  }
  return pos;
}

function topoSortSafe(eqs) {
  try {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const dfs = (node) => {
      if (visited.has(node)) return;
      if (visiting.has(node)) return;
      visiting.add(node);
      for (const parent of eqs.get(node) || []) {
        dfs(parent);
      }
      visiting.delete(node);
      visited.add(node);
      order.push(node);
    };

    for (const node of eqs.keys()) {
      dfs(node);
    }

    return order;
  } catch {
    return [...eqs.keys()];
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
  displayValues,
  ranges,
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
    const positions = features.layoutFreeform ? null : layoutLeftRight(eqs);

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
            node = { ...node, data: { id, value: 0, min: -100, max: 100 } };
            mutated = true;
          }
          return node;
        }

        mutated = true;
        return {
          id,
          type: "circle",
          position: desiredPosition,
          data: { id, value: 0, min: -100, max: 100 },
          draggable: true,
        };
      });
      return mutated ? next : prev;
    });
  }, [eqs, allVars, features.layoutFreeform, setNodes]);

  useEffect(() => {
    setNodes((prev) => applyNodeData(prev, displayValues, ranges));
  }, [displayValues, ranges, setNodes]);

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
              edge = { ...edge, data: { hot: false, pulseMs: features.flowPulseMs } };
              mutated = true;
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
              data: { hot: false, pulseMs: features.flowPulseMs },
              style: desiredStyle,
              markerEnd: desiredMarker,
            });
          }
        }
      }

      if (!mutated && next.length !== prev.length) mutated = true;
      return mutated ? next : prev;
    });
  }, [eqs, features.anchorHandles, baseEdgeType, nodePositionSignature, setEdges, features.flowPulseMs]);

  useEffect(() => {
    setEdges((prev) =>
      applyEdgeVisualState(prev, edgeHot, {
        causalFlow: features.causalFlow,
        flowPulseMs: features.flowPulseMs,
        edgeStraightening: features.edgeStraightening,
      })
    );
  }, [edgeHot, features.causalFlow, features.flowPulseMs, features.edgeStraightening, setEdges]);

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

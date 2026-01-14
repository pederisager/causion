import { create } from "zustand";
import { applyEdgeChanges, applyNodeChanges } from "reactflow";
import { NODE_HEIGHT, NODE_WIDTH, DEFAULT_FEATURE_FLAGS } from "../components/constants.js";
import { computeDeterministicValues, buildParentMap, wouldCreateCycle } from "../graph/dagMath.js";

const STYLE_PRESET = DEFAULT_FEATURE_FLAGS.stylePreset || "causion";
const FLOW_PULSE_MS = DEFAULT_FEATURE_FLAGS.flowPulseMs || 900;
const DEFAULT_RANGE = { min: -100, max: 100 };

const LETTER_SEQUENCE = ["X", "Y", "Z"];

function clampNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatWeight(weight) {
  const numeric = clampNumber(weight, 0);
  const fixed = numeric.toFixed(2);
  return fixed.replace(/\.?0+$/, "");
}

function nextNodeName(existingIds) {
  for (const letter of LETTER_SEQUENCE) {
    if (!existingIds.has(letter)) return letter;
  }
  let index = 1;
  while (existingIds.has(`X${index}`)) {
    index += 1;
  }
  return `X${index}`;
}

function nodeCenter(node) {
  const x = node?.position?.x ?? 0;
  const y = node?.position?.y ?? 0;
  return { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT / 2 };
}

function pickHandleFromDelta(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "R" : "L";
  }
  return dy >= 0 ? "B" : "T";
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

function withNodeDefaults(node) {
  const data = node.data || {};
  const min = clampNumber(data.min, DEFAULT_RANGE.min);
  const max = clampNumber(data.max, DEFAULT_RANGE.max);
  const sliderValue = clampNumber(data.sliderValue, clampNumber(data.value, 0));
  const isLocked = Boolean(data.isLocked);
  return {
    ...node,
    type: "circle",
    data: {
      id: node.id,
      name: data.name ?? node.id,
      value: clampNumber(data.value, 0),
      sliderValue,
      isLocked,
      bias: clampNumber(data.bias, 0),
      min,
      max,
      doActive: isLocked,
      isControlled: isLocked,
      stylePreset: STYLE_PRESET,
    },
  };
}

function withEdgeDefaults(edge, nodes, lockedTargets) {
  const data = edge.data || {};
  const weight = clampNumber(data.weight, 1);
  const sourceNode = nodes.find((node) => node.id === edge.source);
  const targetNode = nodes.find((node) => node.id === edge.target);
  let sourceHandle;
  let targetHandle;
  if (sourceNode && targetNode) {
    const sourceCenter = nodeCenter(sourceNode);
    const targetCenter = nodeCenter(targetNode);
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    sourceHandle = mapHandleId(pickHandleFromDelta(dx, dy), "s");
    targetHandle = mapHandleId(pickHandleFromDelta(-dx, -dy), "t");
  }

  return {
    ...edge,
    id: edge.id ?? `${edge.source}->${edge.target}`,
    type: "causal",
    sourceHandle,
    targetHandle,
    data: {
      ...data,
      weight,
      effectLabel: formatWeight(weight),
      disabledByDo: lockedTargets.has(edge.target),
      hot: true,
      pulseMs: FLOW_PULSE_MS,
      stylePreset: STYLE_PRESET,
    },
  };
}

function recomputeGraph(nodes, edges) {
  const normalizedNodes = nodes.map(withNodeDefaults);
  const values = computeDeterministicValues(normalizedNodes, edges);
  const nextNodes = normalizedNodes.map((node) => {
    const data = node.data || {};
    const value = clampNumber(values[node.id], data.value ?? 0);
    return {
      ...node,
      data: {
        ...data,
        value,
        doActive: Boolean(data.isLocked),
        isControlled: Boolean(data.isLocked),
        stylePreset: STYLE_PRESET,
      },
    };
  });
  const lockedTargets = new Set(
    nextNodes.filter((node) => node.data?.isLocked).map((node) => node.id)
  );
  const nextEdges = edges.map((edge) => withEdgeDefaults(edge, nextNodes, lockedTargets));
  return { nodes: nextNodes, edges: nextEdges };
}

function getInitialGraph() {
  const nodes = [
    {
      id: "X",
      position: { x: 40, y: 120 },
      data: { sliderValue: 0, value: 0, min: -100, max: 100, isLocked: false, bias: 0 },
    },
    {
      id: "Y",
      position: { x: 320, y: 120 },
      data: { sliderValue: 0, value: 0, min: -100, max: 100, isLocked: false, bias: 0 },
    },
  ];
  const edges = [
    {
      id: "X->Y",
      source: "X",
      target: "Y",
      data: { weight: 1 },
    },
  ];
  return recomputeGraph(nodes, edges);
}

export const useDagStore = create((set, get) => ({
  mode: "beginner",
  notice: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  ...getInitialGraph(),
  setNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: null }),
  selectNode: (nodeId) =>
    set({
      selectedNodeId: nodeId ?? null,
      selectedEdgeId: nodeId ? null : get().selectedEdgeId,
    }),
  selectEdge: (edgeId) =>
    set({
      selectedEdgeId: edgeId ?? null,
      selectedNodeId: edgeId ? null : get().selectedNodeId,
    }),
  addNode: (position, optionalName) => {
    const state = get();
    const existingIds = new Set(state.nodes.map((node) => node.id));
    const name = optionalName && !existingIds.has(optionalName) ? optionalName : nextNodeName(existingIds);
    const nextNodes = [
      ...state.nodes,
      {
        id: name,
        position: position || { x: 0, y: 0 },
        data: { sliderValue: 0, value: 0, min: -100, max: 100, isLocked: false, bias: 0 },
      },
    ];
    const { nodes, edges } = recomputeGraph(nextNodes, state.edges);
    set({
      nodes,
      edges,
      selectedNodeId: name,
      selectedEdgeId: null,
    });
    return name;
  },
  deleteNode: (nodeId) => {
    const state = get();
    const nextNodes = state.nodes.filter((node) => node.id !== nodeId);
    const nextEdges = state.edges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId
    );
    const { nodes, edges } = recomputeGraph(nextNodes, nextEdges);
    set({
      nodes,
      edges,
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    });
  },
  renameNode: (nodeId, nextName) => {
    const trimmed = String(nextName || "").trim();
    if (!trimmed) {
      set({ notice: "Name cannot be empty." });
      return false;
    }
    const state = get();
    if (state.nodes.some((node) => node.id === trimmed && node.id !== nodeId)) {
      set({ notice: `Name "${trimmed}" already exists.` });
      return false;
    }
    const nextNodes = state.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            id: trimmed,
            data: { ...node.data, name: trimmed },
          }
        : node
    );
    const nextEdges = state.edges.map((edge) => {
      const nextEdge = { ...edge };
      if (edge.source === nodeId) nextEdge.source = trimmed;
      if (edge.target === nodeId) nextEdge.target = trimmed;
      if (edge.source === nodeId || edge.target === nodeId) {
        nextEdge.id = `${nextEdge.source}->${nextEdge.target}`;
      }
      return nextEdge;
    });
    const { nodes, edges } = recomputeGraph(nextNodes, nextEdges);
    set({
      nodes,
      edges,
      selectedNodeId: trimmed,
    });
    return true;
  },
  setSliderValue: (nodeId, value) => {
    const state = get();
    const nextNodes = state.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, sliderValue: clampNumber(value, 0) } }
        : node
    );
    const { nodes, edges } = recomputeGraph(nextNodes, state.edges);
    set({ nodes, edges });
  },
  toggleLock: (nodeId) => {
    const state = get();
    const nextNodes = state.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, isLocked: !node.data?.isLocked } }
        : node
    );
    const { nodes, edges } = recomputeGraph(nextNodes, state.edges);
    set({ nodes, edges });
  },
  addEdge: (source, target) => {
    if (!source || !target) return false;
    if (source === target) {
      set({ notice: "DAGs can’t have self-loops." });
      return false;
    }
    const state = get();
    if (state.edges.some((edge) => edge.source === source && edge.target === target)) {
      set({ notice: "That edge already exists." });
      return false;
    }
    if (wouldCreateCycle(source, target, state.edges)) {
      set({ notice: "DAGs can’t have feedback loops." });
      return false;
    }
    const nextEdges = [
      ...state.edges,
      {
        id: `${source}->${target}`,
        source,
        target,
        data: { weight: 1 },
      },
    ];
    const { nodes, edges } = recomputeGraph(state.nodes, nextEdges);
    set({
      nodes,
      edges,
      selectedEdgeId: `${source}->${target}`,
      selectedNodeId: null,
    });
    return true;
  },
  deleteEdge: (edgeId) => {
    const state = get();
    const nextEdges = state.edges.filter((edge) => edge.id !== edgeId);
    const { nodes, edges } = recomputeGraph(state.nodes, nextEdges);
    set({
      nodes,
      edges,
      selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
    });
  },
  setEdgeWeight: (edgeId, weight) => {
    const state = get();
    const nextEdges = state.edges.map((edge) =>
      edge.id === edgeId
        ? { ...edge, data: { ...edge.data, weight: clampNumber(weight, 0) } }
        : edge
    );
    const { nodes, edges } = recomputeGraph(state.nodes, nextEdges);
    set({ nodes, edges });
  },
  setNodesFromChanges: (changes) => {
    const state = get();
    const updatedNodes = applyNodeChanges(changes, state.nodes);
    const nodeIds = new Set(updatedNodes.map((node) => node.id));
    const filteredEdges = state.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    const { nodes, edges } = recomputeGraph(updatedNodes, filteredEdges);
    set({ nodes, edges });
  },
  setEdgesFromChanges: (changes) => {
    const state = get();
    const updatedEdges = applyEdgeChanges(changes, state.edges);
    const { nodes, edges } = recomputeGraph(state.nodes, updatedEdges);
    set({ nodes, edges });
  },
  resetGraph: () => {
    const initial = getInitialGraph();
    set({
      ...initial,
      selectedNodeId: null,
      selectedEdgeId: null,
      notice: null,
    });
  },
  getParentMap: () => buildParentMap(get().nodes, get().edges),
}));

export const __TEST_ONLY__ = {
  nextNodeName,
  formatWeight,
};


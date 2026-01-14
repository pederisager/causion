import { topoSort } from "./topology.js";

export function buildParentMap(nodes, edges) {
  const map = new Map();
  for (const node of nodes) {
    map.set(node.id, new Set());
  }
  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, new Set());
    if (!map.has(edge.target)) map.set(edge.target, new Set());
    map.get(edge.target).add(edge.source);
  }
  return map;
}

export function wouldCreateCycle(source, target, edges) {
  if (!source || !target) return false;
  if (source === target) return true;
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    adjacency.get(edge.source).add(edge.target);
  }
  const stack = [target];
  const visited = new Set();
  while (stack.length) {
    const node = stack.pop();
    if (node === source) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const next = adjacency.get(node);
    if (!next) continue;
    for (const child of next) {
      if (!visited.has(child)) stack.push(child);
    }
  }
  return false;
}

export function computeDeterministicValues(nodes, edges) {
  const parentMap = buildParentMap(nodes, edges);
  let order = [];
  try {
    order = topoSort(parentMap);
  } catch (error) {
    order = Array.from(parentMap.keys());
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const weightByTarget = new Map();
  for (const edge of edges) {
    const weight = Number(edge.data?.weight ?? edge.weight ?? 0);
    const bucket = weightByTarget.get(edge.target) || new Map();
    bucket.set(edge.source, weight);
    weightByTarget.set(edge.target, bucket);
  }

  const values = {};
  for (const id of order) {
    const node = nodeMap.get(id);
    if (!node) continue;
    const data = node.data || {};
    const parents = parentMap.get(id) || new Set();
    let nextValue;
    if (data.isLocked || parents.size === 0) {
      nextValue = Number(data.sliderValue ?? data.value ?? 0);
    } else {
      let sum = Number(data.bias ?? 0);
      const weights = weightByTarget.get(id);
      for (const parentId of parents) {
        const parentValue = values[parentId] ?? Number(nodeMap.get(parentId)?.data?.value ?? 0);
        const weight = Number(weights?.get(parentId) ?? 0);
        sum += weight * parentValue;
      }
      nextValue = sum;
    }
    values[id] = nextValue;
  }

  return values;
}


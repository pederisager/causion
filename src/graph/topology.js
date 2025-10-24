/**
 * Convert an SCM model map into adjacency information where each node points
 * to the set of its direct parent variables.
 *
 * @param {Map<string, { dependencies: Set<string> }>} model - Parsed SCM model.
 * @returns {Map<string, Set<string>>} A map of variable -> set of parent variables.
 */
export function depsFromModel(model) {
  const eqs = new Map();
  if (!model) return eqs;

  for (const [child, spec] of model) {
    const parentKeys = spec?.dependencies ? [...spec.dependencies] : [];
    eqs.set(child, new Set(parentKeys));
  }

  return eqs;
}

/**
 * Perform a topological sort on a dependency map.
 *
 * @param {Map<string, Set<string>>} eqs - Dependency map created by {@link depsFromModel}.
 * @returns {string[]} Nodes ordered from sources to sinks.
 * @throws {Error} If the graph contains a cycle.
 */
export function topoSort(eqs) {
  const graph = eqs ?? new Map();
  const nodeIds = [...graph.keys()];
  const indegrees = new Map(nodeIds.map((node) => [node, 0]));

  for (const [child, parents] of graph) {
    for (const parent of parents) {
      indegrees.set(child, (indegrees.get(child) || 0) + 1);
      if (!indegrees.has(parent)) {
        indegrees.set(parent, indegrees.get(parent) || 0);
      }
    }
  }

  const queue = nodeIds.filter((node) => (indegrees.get(node) || 0) === 0);
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);

    for (const [child, parents] of graph) {
      if (!parents.has(node)) continue;
      indegrees.set(child, indegrees.get(child) - 1);
      if (indegrees.get(child) === 0) {
        queue.push(child);
      }
    }
  }

  if (order.length !== indegrees.size) {
    throw new Error("SCM contains a cycle (not a DAG).");
  }

  return order;
}

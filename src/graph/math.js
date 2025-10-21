import { topoSort } from "./topology.js";

/**
 * Propagate values across the DAG according to the provided SCM model.
 *
 * @param {Map<string, { parents: Record<string, number>, constant: number }>} model - Parsed SCM model.
 * @param {Map<string, Set<string>>} eqs - Dependency map derived from the model.
 * @param {Record<string, number>} currentValues - Current node values before propagation.
 * @param {Record<string, boolean>} clampMap - Nodes that should remain fixed.
 * @returns {Record<string, number>} A new object with propagated values.
 */
export function computeValues(model, eqs, currentValues, clampMap = {}) {
  const order = topoSort(eqs);
  const next = { ...currentValues };

  for (const node of order) {
    if (clampMap[node]) continue;
    const spec = model.get(node) || { parents: {}, constant: 0 };
    const parents = spec.parents || {};
    let sum = 0;
    for (const [parent, coefficient] of Object.entries(parents)) {
      sum += coefficient * (next[parent] ?? 0);
    }
    next[node] = spec.constant + sum;
  }

  return next;
}

/**
 * Shallow object equality helper used for value comparisons in React state.
 *
 * @template T extends Record<string, unknown>
 * @param {T} a
 * @param {T} b
 * @returns {boolean} True when both objects contain the same key/value pairs.
 */
export function shallowEqualObj(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

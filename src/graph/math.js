import { topoSort } from "./topology.js";
import { evaluateExpression } from "./interpreter.js";

/**
 * Propagate values across the DAG according to the provided SCM model.
 *
 * @param {Map<string, { ast: import("jsep").Expression | null, dependencies: Set<string> }>} model - Parsed SCM model.
 * @param {Map<string, Set<string>>} eqs - Dependency map derived from the model.
 * @param {Record<string, number>} currentValues - Current node values before propagation.
 * @param {Record<string, boolean>} clampMap - Nodes that should remain fixed.
 * @returns {Record<string, number>} A new object with propagated values.
 */
export function computeValues(model, eqs, currentValues, clampMap = {}) {
  const order = topoSort(eqs);
  const next = { ...currentValues };
  const scope = new Proxy(next, {
    has(target, key) {
      if (typeof key === "symbol") return key in target;
      return true;
    },
    get(target, key) {
      if (typeof key === "symbol") {
        return Reflect.get(target, key);
      }
      if (key === "error") return 0;
      const value = target[key];
      return value == null ? 0 : value;
    },
  });

  for (const node of order) {
    if (next[node] == null) {
      next[node] = 0;
    }
    if (clampMap[node]) continue;
    const spec = model.get(node);
    if (!spec || !spec.ast) {
      if (spec?.derived) {
        next[node] = 0;
      }
      continue;
    }
    try {
      next[node] = evaluateExpression(spec.ast, scope);
    } catch (error) {
      const message = error?.message || String(error);
      const source = spec.source || "expression";
      throw new Error(`Error evaluating ${node} = ${source}: ${message}`, { cause: error });
    }
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

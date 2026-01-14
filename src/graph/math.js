import { topoSort } from "./topology.js";
import { evaluateExpression } from "./interpreter.js";

/**
 * Propagate values across the DAG according to the provided SCM model.
 *
 * @param {Map<string, { ast: import("jsep").Expression | null, dependencies: Set<string> }>} model - Parsed SCM model.
 * @param {Map<string, Set<string>>} eqs - Dependency map derived from the model.
 * @param {Record<string, number>} currentValues - Current node values before propagation.
 * @param {Record<string, boolean>} clampMap - Nodes that should remain fixed.
 * @param {{
 *   enabled?: boolean,
 *   byTarget?: Record<string, number>,
 *   byNode?: Record<string, number>,
 *   nodes?: Set<string>
 * } | null} noiseState - Optional noise mapping to inject per node.
 * @returns {Record<string, number>} A new object with propagated values.
 */
export function computeValues(model, eqs, currentValues, clampMap = {}, noiseState = null) {
  const order = topoSort(eqs);
  const next = { ...currentValues };
  const noiseEnabled = !!noiseState?.enabled;
  const noiseByTarget = noiseState?.byTarget || {};
  const noiseByNode = noiseState?.byNode || {};
  const noiseNodes = noiseState?.nodes || new Set();
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

  if (noiseEnabled) {
    for (const [noiseId, noiseValue] of Object.entries(noiseByNode)) {
      next[noiseId] = noiseValue;
    }
  }

  for (const node of order) {
    if (next[node] == null) {
      next[node] = 0;
    }
    if (noiseEnabled && noiseNodes.has(node)) {
      continue;
    }
    if (clampMap[node]) continue;
    const spec = model.get(node);
    let baseValue = next[node];
    if (!spec || !spec.ast) {
      if (spec?.derived) {
        baseValue = 0;
      }
    } else {
      try {
        baseValue = evaluateExpression(spec.ast, scope);
      } catch (error) {
        const message = error?.message || String(error);
        const source = spec.source || "expression";
        throw new Error(`Error evaluating ${node} = ${source}: ${message}`, { cause: error });
      }
    }
    if (noiseEnabled && Object.prototype.hasOwnProperty.call(noiseByTarget, node)) {
      baseValue += noiseByTarget[node];
    }
    next[node] = baseValue;
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
    const valA = a[key];
    const valB = b[key];
    if (valA === valB) continue;
    if (typeof valA === "number" && typeof valB === "number") {
      if (Number.isNaN(valA) && Number.isNaN(valB)) {
        continue;
      }
    }
    return false;
  }
  return true;
}

const STATUS_PRIORITY = {
  bad: 3,
  maybe: 2,
  good: 1,
};

function ensureSet(map, key) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  return map.get(key);
}

export function buildChildrenMap(eqs) {
  const childrenMap = new Map();
  for (const [child, parents] of eqs || []) {
    ensureSet(childrenMap, child);
    for (const parent of parents || []) {
      ensureSet(childrenMap, parent).add(child);
    }
  }
  return childrenMap;
}

export function buildDescendantsMap(childrenMap) {
  const memo = new Map();
  const visiting = new Set();

  const visit = (node) => {
    if (memo.has(node)) return memo.get(node);
    if (visiting.has(node)) return new Set();
    visiting.add(node);
    const descendants = new Set();
    const children = childrenMap.get(node) || new Set();
    for (const child of children) {
      descendants.add(child);
      const childDesc = visit(child);
      for (const item of childDesc) {
        descendants.add(item);
      }
    }
    visiting.delete(node);
    memo.set(node, descendants);
    return descendants;
  };

  for (const node of childrenMap.keys()) {
    visit(node);
  }
  return memo;
}

export function buildUndirectedAdjacency(eqs, excludeNodes) {
  const adjacency = new Map();
  const excludeSet =
    excludeNodes && excludeNodes instanceof Set ? excludeNodes : new Set(excludeNodes || []);
  const shouldSkip = (node) => excludeSet.has(node);

  const addEdge = (a, b) => {
    if (shouldSkip(a) || shouldSkip(b)) return;
    ensureSet(adjacency, a).add(b);
    ensureSet(adjacency, b).add(a);
  };

  for (const [child, parents] of eqs || []) {
    if (!shouldSkip(child)) {
      ensureSet(adjacency, child);
    }
    for (const parent of parents || []) {
      addEdge(child, parent);
    }
  }
  return adjacency;
}

export function findSimplePaths(adjacency, start, end, { maxDepth = 8, maxPaths = 250 } = {}) {
  const results = [];
  if (!adjacency?.has(start) || !adjacency?.has(end)) return results;

  const maxNodes = Math.max(2, Number.isFinite(maxDepth) ? maxDepth : 8);
  const maxCount = Math.max(1, Number.isFinite(maxPaths) ? maxPaths : 250);

  const walk = (node, path, visited) => {
    if (results.length >= maxCount) return;
    if (path.length > maxNodes) return;
    if (node === end) {
      results.push([...path]);
      return;
    }
    const neighbors = Array.from(adjacency.get(node) || []).sort();
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      path.push(neighbor);
      walk(neighbor, path, visited);
      path.pop();
      visited.delete(neighbor);
      if (results.length >= maxCount) return;
    }
  };

  const visited = new Set([start]);
  walk(start, [start], visited);
  return results;
}

export function isDirectedPath(path, parentsMap) {
  if (!Array.isArray(path) || path.length < 2) return false;
  let forward = true;
  let backward = true;
  for (let i = 0; i < path.length - 1; i += 1) {
    const current = path[i];
    const next = path[i + 1];
    const nextParents = parentsMap.get(next) || new Set();
    const currentParents = parentsMap.get(current) || new Set();
    if (!nextParents.has(current)) {
      forward = false;
    }
    if (!currentParents.has(next)) {
      backward = false;
    }
    if (!forward && !backward) return false;
  }
  return forward || backward;
}

export function isPathOpen(path, controls, parentsMap, descendantsMap) {
  if (!Array.isArray(path) || path.length <= 2) return true;
  const controlSet = controls instanceof Set ? controls : new Set(controls || []);

  for (let i = 1; i < path.length - 1; i += 1) {
    const prev = path[i - 1];
    const node = path[i];
    const next = path[i + 1];
    const parents = parentsMap.get(node) || new Set();
    const prevIsParent = parents.has(prev);
    const nextIsParent = parents.has(next);
    const isCollider = prevIsParent && nextIsParent;

    if (isCollider) {
      if (controlSet.has(node)) {
        continue;
      }
      const descendants = descendantsMap.get(node);
      let hasControlledDescendant = false;
      if (descendants) {
        for (const descendant of descendants) {
          if (controlSet.has(descendant)) {
            hasControlledDescendant = true;
            break;
          }
        }
      }
      if (!hasControlledDescendant) {
        return false;
      }
    } else if (controlSet.has(node)) {
      return false;
    }
  }
  return true;
}

function applyStatus(map, edgeId, status) {
  const existing = map.get(edgeId);
  if (!existing) {
    map.set(edgeId, status);
    return;
  }
  if ((STATUS_PRIORITY[status] || 0) > (STATUS_PRIORITY[existing] || 0)) {
    map.set(edgeId, status);
  }
}

export function computeEdgeDsepMap({
  eqs,
  x,
  y,
  controls = [],
  excludeNodes,
  maxDepth = 8,
  maxPaths = 250,
} = {}) {
  if (!x || !y || x === y) return new Map();
  const excludeSet =
    excludeNodes && excludeNodes instanceof Set ? excludeNodes : new Set(excludeNodes || []);
  if (excludeSet.has(x) || excludeSet.has(y)) return new Map();

  const controlsList = Array.isArray(controls) ? controls : [];
  const filteredControls = controlsList.filter(
    (id) => id && !excludeSet.has(id)
  );
  if (filteredControls.length === 0) return new Map();

  const parentsMap = eqs ?? new Map();
  const childrenMap = buildChildrenMap(parentsMap);
  const descendantsMap = buildDescendantsMap(childrenMap);
  const adjacency = buildUndirectedAdjacency(parentsMap, excludeSet);
  const paths = findSimplePaths(adjacency, x, y, { maxDepth, maxPaths });
  if (!paths.length) return new Map();

  const controlsSet = new Set(filteredControls);
  const emptyControls = new Set();
  const edgeStatus = new Map();

  for (const path of paths) {
    const openWithout = isPathOpen(path, emptyControls, parentsMap, descendantsMap);
    const openWith = isPathOpen(path, controlsSet, parentsMap, descendantsMap);
    if (openWithout === openWith) continue;
    let status = null;
    if (!openWithout && openWith) {
      status = "bad";
    } else if (openWithout && !openWith) {
      status = isDirectedPath(path, parentsMap) ? "maybe" : "good";
    }
    if (!status) continue;

    for (let i = 0; i < path.length - 1; i += 1) {
      const left = path[i];
      const right = path[i + 1];
      let edgeId = null;
      if ((parentsMap.get(right) || new Set()).has(left)) {
        edgeId = `${left}->${right}`;
      } else if ((parentsMap.get(left) || new Set()).has(right)) {
        edgeId = `${right}->${left}`;
      }
      if (edgeId) {
        applyStatus(edgeStatus, edgeId, status);
      }
    }
  }

  return edgeStatus;
}

export const __TEST_ONLY__ = {
  STATUS_PRIORITY,
};


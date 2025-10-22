export function buildGraphSignature(eqs) {
  if (!eqs || typeof eqs[Symbol.iterator] !== 'function') {
    return '[]';
  }

  const entries = [];
  for (const [child, parents] of eqs) {
    const orderedParents = Array.isArray(parents)
      ? [...parents].sort()
      : Array.from(parents ?? []).sort();
    entries.push([child, orderedParents]);
  }

  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify(entries);
}

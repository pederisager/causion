export const NOISE_PREFIX = "noise:";

export function buildNoiseId(baseId) {
  return `${NOISE_PREFIX}${baseId}`;
}

export function isNoiseId(id) {
  return String(id || "").startsWith(NOISE_PREFIX);
}

export function getNoiseTargetId(noiseId) {
  if (!isNoiseId(noiseId)) return "";
  return String(noiseId).slice(NOISE_PREFIX.length);
}

export function buildNoiseLabel(noiseId) {
  const target = getNoiseTargetId(noiseId);
  return target ? `U_${target}` : String(noiseId || "");
}

export function buildNoiseAugmentedGraph(eqs, allVars) {
  const baseVars = new Set(allVars || []);
  const nextEqs = new Map();
  const noiseNodes = new Set();

  for (const id of baseVars) {
    if (isNoiseId(id)) continue;
    noiseNodes.add(buildNoiseId(id));
  }

  for (const [child, parents] of eqs || []) {
    const nextParents = new Set(parents || []);
    if (!isNoiseId(child)) {
      const noiseId = buildNoiseId(child);
      nextParents.add(noiseId);
      noiseNodes.add(noiseId);
    }
    nextEqs.set(child, nextParents);
  }

  for (const id of baseVars) {
    if (!nextEqs.has(id)) nextEqs.set(id, new Set());
    if (!isNoiseId(id)) {
      nextEqs.get(id).add(buildNoiseId(id));
    }
  }

  noiseNodes.forEach((noiseId) => {
    if (!nextEqs.has(noiseId)) nextEqs.set(noiseId, new Set());
  });

  const nextAllVars = new Set([...baseVars, ...noiseNodes]);

  return {
    eqs: nextEqs,
    allVars: nextAllVars,
    noiseNodes,
  };
}

export function sampleGaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

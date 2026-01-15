import { computeValues } from "../graph/math.js";
import { sampleGaussian, isNoiseId, getNoiseTargetId } from "./noiseUtils.js";

const DEFAULT_RANGE = { min: -100, max: 100 };

/**
 * Find root nodes (nodes with no causal parents, excluding noise nodes).
 *
 * @param {Map<string, Set<string>>} eqs - Dependency graph
 * @returns {string[]} Array of root node IDs
 */
export function findRootNodes(eqs) {
  const roots = [];
  for (const [nodeId, parents] of eqs) {
    if (isNoiseId(nodeId)) continue;
    // Filter out noise parents - only consider real causal parents
    const realParents = Array.from(parents || []).filter((p) => !isNoiseId(p));
    if (realParents.length === 0) {
      roots.push(nodeId);
    }
  }
  return roots;
}

/**
 * Filter variables to exclude noise nodes and return sorted array.
 *
 * @param {Set<string> | string[]} allVars - All variable names including noise nodes
 * @returns {string[]} Sorted array of user-defined variables (no noise: prefix)
 */
export function getUserVariables(allVars) {
  return Array.from(allVars || [])
    .filter((id) => !isNoiseId(id))
    .sort();
}

/**
 * Generate N samples from an SCM model.
 *
 * @param {Object} options
 * @param {Map<string, { ast: object | null, dependencies: Set<string> }>} options.model - Parsed SCM model
 * @param {Map<string, Set<string>>} options.eqs - Dependency graph (noise-augmented)
 * @param {Set<string> | string[]} options.allVars - All variable names
 * @param {Record<string, number>} options.values - Current values (used as base)
 * @param {Record<string, boolean>} options.interventions - do() interventions
 * @param {Record<string, { min: number, max: number }>} options.ranges - Variable ranges
 * @param {{ enabled?: boolean, amount?: number }} options.noiseConfig - Noise settings
 * @param {number} options.sampleCount - Number of samples to generate
 * @returns {Object[]} Array of sample objects with user variable values
 */
export function generateSamples({
  model,
  eqs,
  allVars,
  values,
  interventions = {},
  ranges = {},
  noiseConfig = {},
  sampleCount,
}) {
  const samples = [];
  const userVars = getUserVariables(allVars);
  const allVarsArray = Array.from(allVars || []);

  const noiseEnabled = !!noiseConfig?.enabled;
  const noiseAmount = Math.max(0, Number(noiseConfig?.amount) || 0);

  // Find root nodes (nodes with no causal parents) for randomization when noise is off
  // Note: We filter out intervened roots inside the loop since clampMap is rebuilt per sample
  const allRootNodes = findRootNodes(eqs);

  for (let i = 0; i < sampleCount; i++) {
    // Build clampMap fresh for each sample from interventions (do() operations)
    const clampMap = {};
    for (const id of allVarsArray) {
      clampMap[id] = !!interventions[id];
    }

    // Start with a copy of current values
    const sampleValues = { ...values };

    // Build noise state for this sample
    let noiseState = null;

    if (noiseEnabled && noiseAmount > 0) {
      // NOISE MODE: Vary noise nodes (U_X) with Gaussian noise
      const byTarget = {};
      const byNode = {};
      const nodes = new Set();

      for (const id of allVarsArray) {
        if (!isNoiseId(id)) continue;
        const target = getNoiseTargetId(id);
        if (!target) continue;

        const range = ranges?.[target] || DEFAULT_RANGE;
        const span = range.max - range.min;
        const sigma = Math.abs(noiseAmount * (Number.isFinite(span) ? span : 0));
        const noiseValue = sigma > 0 ? sampleGaussian() * sigma : 0;

        byTarget[target] = noiseValue;
        byNode[id] = noiseValue;
        nodes.add(id);
      }

      noiseState = { enabled: true, byTarget, byNode, nodes };
    } else {
      // NO NOISE MODE: Vary root nodes uniformly within their ranges
      // Filter out already-clamped roots (from interventions)
      const rootNodes = allRootNodes.filter((id) => !clampMap[id]);
      for (const rootId of rootNodes) {
        const range = ranges?.[rootId] || DEFAULT_RANGE;
        const span = range.max - range.min;
        // Uniform random value within range
        const randomValue = range.min + Math.random() * span;
        sampleValues[rootId] = randomValue;
        // Mark root as clamped so computeValues doesn't overwrite with AST evaluation
        clampMap[rootId] = true;
      }
    }

    // Compute values for this sample
    let computed;
    try {
      computed = computeValues(model, eqs, sampleValues, clampMap, noiseState);
    } catch (error) {
      // On error, use sample values as fallback
      computed = { ...sampleValues };
    }

    // Clamp to ranges and extract user variables only
    const sample = {};
    for (const varName of userVars) {
      let value = computed[varName] ?? 0;
      const range = ranges?.[varName];
      if (range) {
        if (Number.isFinite(value)) {
          value = Math.min(range.max, Math.max(range.min, value));
        }
      }
      sample[varName] = value;
    }
    samples.push(sample);
  }

  return samples;
}

/**
 * Convert samples array to CSV string.
 *
 * @param {Object[]} samples - Array of sample objects
 * @param {string[]} columns - Column names (user variables)
 * @returns {string} CSV-formatted string with header row
 */
export function samplesToCSV(samples, columns) {
  if (!samples.length || !columns.length) return "";

  const header = columns.join(",");
  const rows = samples.map((sample) =>
    columns
      .map((col) => {
        const value = sample[col];
        if (!Number.isFinite(value)) return "";
        return value.toString();
      })
      .join(",")
  );

  return [header, ...rows].join("\n");
}

/**
 * Trigger browser download of CSV content.
 *
 * @param {string} csvContent - CSV-formatted string
 * @param {string} filename - Download filename
 */
export function downloadCSV(csvContent, filename = "simulation.csv") {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

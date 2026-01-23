import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fitLinearRegression,
  buildLoessLine,
  computeResidualizedSamples,
  computeCorrelationStats,
  formatStat,
  formatPValue,
} from "../../src/utils/regressionUtils.js";

test("fitLinearRegression returns expected slope/intercept", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 1, y: 2 },
    { x: 2, y: 4 },
  ];
  const fit = fitLinearRegression(points);
  assert.ok(fit, "expected fit to be defined");
  assert.ok(Math.abs(fit.slope - 2) < 1e-8);
  assert.ok(Math.abs(fit.intercept) < 1e-8);
});

test("computeResidualizedSamples removes linear control effects", () => {
  const samples = Array.from({ length: 5 }, (_, index) => {
    const z = index;
    return {
      id: `s-${index}`,
      timestamp: index,
      values: { X: z, Y: 2 * z, Z: z },
    };
  });

  const result = computeResidualizedSamples(samples, "X", "Y", ["Z"]);

  assert.equal(result.status, "adjusted");
  result.points.forEach((point) => {
    assert.ok(Math.abs(point.x) < 1e-8);
    assert.ok(Math.abs(point.y) < 1e-8);
  });
});

test("buildLoessLine returns a smooth line for simple data", () => {
  const points = Array.from({ length: 12 }, (_, index) => ({
    x: index,
    y: index * 1.2 + 0.5,
  }));
  const line = buildLoessLine(points, { bandwidth: 0.5, steps: 16 });
  assert.ok(line && line.length >= 2, "expected a loess line");
});

// Tests for computeCorrelationStats

test("computeCorrelationStats returns null for fewer than 3 points", () => {
  assert.equal(computeCorrelationStats([]), null);
  assert.equal(computeCorrelationStats([{ x: 0, y: 0 }]), null);
  assert.equal(
    computeCorrelationStats([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]),
    null
  );
});

test("computeCorrelationStats returns r=1 for perfect positive correlation", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 1, y: 2 },
    { x: 2, y: 4 },
    { x: 3, y: 6 },
  ];
  const stats = computeCorrelationStats(points);
  assert.ok(stats, "expected stats to be defined");
  assert.ok(Math.abs(stats.r - 1) < 1e-8, `expected r=1, got ${stats.r}`);
  assert.ok(Math.abs(stats.slope - 2) < 1e-8, `expected slope=2, got ${stats.slope}`);
  assert.equal(stats.n, 4);
  assert.ok(stats.pValue < 0.01, "expected small p-value for perfect correlation");
});

test("computeCorrelationStats returns r=-1 for perfect negative correlation", () => {
  const points = [
    { x: 0, y: 10 },
    { x: 1, y: 8 },
    { x: 2, y: 6 },
    { x: 3, y: 4 },
  ];
  const stats = computeCorrelationStats(points);
  assert.ok(stats, "expected stats to be defined");
  assert.ok(Math.abs(stats.r - -1) < 1e-8, `expected r=-1, got ${stats.r}`);
  assert.ok(Math.abs(stats.slope - -2) < 1e-8, `expected slope=-2, got ${stats.slope}`);
  assert.ok(stats.pValue < 0.01, "expected small p-value for perfect correlation");
});

test("computeCorrelationStats returns null for zero variance in X", () => {
  const points = [
    { x: 5, y: 1 },
    { x: 5, y: 2 },
    { x: 5, y: 3 },
  ];
  const stats = computeCorrelationStats(points);
  assert.equal(stats, null, "expected null when X has zero variance");
});

test("computeCorrelationStats returns null for zero variance in Y", () => {
  const points = [
    { x: 1, y: 5 },
    { x: 2, y: 5 },
    { x: 3, y: 5 },
  ];
  const stats = computeCorrelationStats(points);
  assert.equal(stats, null, "expected null when Y has zero variance");
});

test("computeCorrelationStats computes reasonable values for uncorrelated data", () => {
  // X increases linearly, Y alternates - weak/no correlation
  const points = [
    { x: 0, y: 1 },
    { x: 1, y: -1 },
    { x: 2, y: 1 },
    { x: 3, y: -1 },
    { x: 4, y: 1 },
  ];
  const stats = computeCorrelationStats(points);
  assert.ok(stats, "expected stats to be defined");
  assert.ok(Math.abs(stats.r) < 0.5, `expected weak correlation, got r=${stats.r}`);
  // p-value should be relatively large for weak correlation
  assert.ok(stats.pValue > 0.1, `expected large p-value for weak correlation, got ${stats.pValue}`);
});

// Tests for formatStat

test("formatStat formats numbers correctly", () => {
  assert.equal(formatStat(1.234), "1.23");
  assert.equal(formatStat(-0.5678), "-0.57");
  assert.equal(formatStat(0), "0.00");
  assert.equal(formatStat(1.999), "2.00");
});

test("formatStat returns NA for invalid values", () => {
  assert.equal(formatStat(null), "NA");
  assert.equal(formatStat(undefined), "NA");
  assert.equal(formatStat(NaN), "NA");
  assert.equal(formatStat(Infinity), "NA");
  assert.equal(formatStat(-Infinity), "NA");
});

test("formatStat respects decimals parameter", () => {
  assert.equal(formatStat(1.23456, 3), "1.235");
  assert.equal(formatStat(1.23456, 0), "1");
  assert.equal(formatStat(1.23456, 4), "1.2346");
});

// Tests for formatPValue

test("formatPValue shows <.001 for very small values", () => {
  assert.equal(formatPValue(0.0001), "<.001");
  assert.equal(formatPValue(0.00001), "<.001");
  assert.equal(formatPValue(0.0000001), "<.001");
});

test("formatPValue uses 3 decimals for small values", () => {
  assert.equal(formatPValue(0.001), "0.001");
  assert.equal(formatPValue(0.005), "0.005");
  assert.equal(formatPValue(0.009), "0.009");
});

test("formatPValue uses 2 decimals for larger values", () => {
  assert.equal(formatPValue(0.01), "0.01");
  assert.equal(formatPValue(0.05), "0.05");
  assert.equal(formatPValue(0.5), "0.50");
  assert.equal(formatPValue(1), "1.00");
});

test("formatPValue returns NA for invalid values", () => {
  assert.equal(formatPValue(null), "NA");
  assert.equal(formatPValue(undefined), "NA");
  assert.equal(formatPValue(NaN), "NA");
});

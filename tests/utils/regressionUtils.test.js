import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fitLinearRegression,
  buildLoessLine,
  computeResidualizedSamples,
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

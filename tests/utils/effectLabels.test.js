import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSCM } from "../../src/graph/parser.js";
import { deriveEffectLabel } from "../../src/utils/effectLabels.js";

function buildModel(source) {
  return parseSCM(source).model;
}

test("deriveEffectLabel returns empty string when dependency missing", () => {
  const model = buildModel(`
    A = 1
    B = 2
  `);
  assert.equal(deriveEffectLabel(model, "A", "B"), "");
});

test("deriveEffectLabel reports sin() for unary function", () => {
  const model = buildModel("B = sin(A)");
  assert.equal(deriveEffectLabel(model, "A", "B"), "sin()");
});

test("deriveEffectLabel extracts scalar coefficient for simple product", () => {
  const model = buildModel("B = 0.5 * A");
  assert.equal(deriveEffectLabel(model, "A", "B"), "0.5");
});

test("deriveEffectLabel extracts scalar coefficient from affine expression", () => {
  const model = buildModel("B = 2 + 0.2 * A");
  assert.equal(deriveEffectLabel(model, "A", "B"), "0.2");
});

test("deriveEffectLabel retains interaction partners", () => {
  const model = buildModel("B = (0.2 * A) * (0.4 * C)");
  assert.equal(deriveEffectLabel(model, "A", "B"), "0.2 * (0.4 * C)");
  assert.equal(deriveEffectLabel(model, "C", "B"), "0.4 * (0.2 * A)");
});

test("deriveEffectLabel handles multiple contributing terms", () => {
  const model = buildModel("B = 0.5 * A + 0.3 * A * C");
  assert.equal(deriveEffectLabel(model, "A", "B"), "0.5 + 0.3 * C");
  assert.equal(deriveEffectLabel(model, "C", "B"), "0.3 * A");
});

test("deriveEffectLabel preserves nested functions", () => {
  const model = buildModel("M = exp(sin(A))");
  assert.equal(deriveEffectLabel(model, "A", "M"), "exp(sin())");
});

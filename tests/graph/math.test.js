import { test } from "node:test";
import assert from "node:assert/strict";
import { computeValues } from "../../src/graph/math.js";
import { depsFromModel } from "../../src/graph/topology.js";
import { parseSCM } from "../../src/graph/parser.js";

const MODEL = new Map([
  ["U", { parents: {}, constant: 2 }],
  ["X", { parents: { U: 0.5 }, constant: 1 }],
  ["Y", { parents: { X: 2 }, constant: -1 }],
]);

const EQS = depsFromModel(MODEL);

test("computeValues propagates values in topological order", () => {
  const current = { U: 4 };
  const clamp = {};
  const next = computeValues(MODEL, EQS, current, clamp);

  // U is recalculated from its constant (2)
  assert.equal(next.U, 2);
  // X should see U's updated value rather than the initial 4
  assert.equal(next.X, 1 + 0.5 * next.U);
  assert.equal(next.Y, -1 + 2 * next.X);
});

test("computeValues respects clamped nodes", () => {
  const current = { U: 4, X: 99, Y: 123 };
  const clamp = { X: true };
  const next = computeValues(MODEL, EQS, current, clamp);

  assert.equal(next.X, 99);
  assert.equal(next.Y, -1 + 2 * next.X);
});

test("computeValues returns a new object", () => {
  const current = { U: 1, X: 2, Y: 3 };
  const clamp = {};
  const result = computeValues(MODEL, EQS, current, clamp);

  assert.notStrictEqual(result, current);
});


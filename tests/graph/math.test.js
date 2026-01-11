import { test } from "node:test";
import assert from "node:assert/strict";
import { computeValues } from "../../src/graph/math.js";
import { depsFromModel } from "../../src/graph/topology.js";
import { parseSCM } from "../../src/graph/parser.js";

const LINEAR_SCM = `
U = 2
X = 1 + 0.5*U
Y = -1 + 2*X
`;

const NONLINEAR_SCM = `
S = 2
T = sin(S) + log(exp(S))
Z = (T > 1) ? T ^ 2 : 0
`;

const HOISTED_SIN_SCM = `
Y = sin(A)
`;

const { model: MODEL } = parseSCM(LINEAR_SCM);
const EQS = depsFromModel(MODEL);

test("computeValues propagates values in topological order", () => {
  const current = { U: 4 };
  const clamp = {};
  const next = computeValues(MODEL, EQS, current, clamp);

  // U is recalculated from its expression (2)
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

test("computeValues evaluates non-linear expressions and helper functions", () => {
  const { model } = parseSCM(NONLINEAR_SCM);
  const eqs = depsFromModel(model);
  const current = {};
  const clamp = {};
  const next = computeValues(model, eqs, current, clamp);

  const expectedT = Math.sin(2) + Math.log(Math.exp(2));
  assert.equal(next.S, 2);
  assert.equal(next.T, expectedT);
  assert.equal(next.Z, expectedT > 1 ? expectedT ** 2 : 0);
});

test("computeValues hoists dependencies for function calls automatically", () => {
  const { model } = parseSCM(HOISTED_SIN_SCM);
  const eqs = depsFromModel(model);
  const next = computeValues(model, eqs, {}, {});

  assert.equal(next.A, 0);
  assert.equal(next.Y, 0);
});


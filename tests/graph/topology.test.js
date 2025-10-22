import { test } from "node:test";
import assert from "node:assert/strict";
import { depsFromModel, topoSort } from "../../src/graph/topology.js";

const MODEL = new Map([
  ["A", { parents: {}, constant: 0 }],
  ["B", { parents: { A: 1 }, constant: 0 }],
  ["C", { parents: { B: 1 }, constant: 0 }],
]);

test("depsFromModel builds parent sets", () => {
  const eqs = depsFromModel(MODEL);
  assert.ok(eqs instanceof Map);
  assert.deepEqual(eqs.get("A"), new Set());
  assert.deepEqual(eqs.get("B"), new Set(["A"]));
});

test("topoSort returns parents before children", () => {
  const eqs = depsFromModel(MODEL);
  const order = topoSort(eqs);
  assert.deepEqual(order, ["A", "B", "C"]);
});

test("topoSort throws on cycles", () => {
  const cyclic = new Map([
    ["A", new Set(["C"])],
    ["B", new Set(["A"])],
    ["C", new Set(["B"])],
  ]);

  assert.throws(() => topoSort(cyclic), /cycle/i);
});

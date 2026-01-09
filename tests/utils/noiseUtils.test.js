import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNoiseAugmentedGraph,
  buildNoiseId,
  getNoiseTargetId,
  isNoiseId,
} from "../../src/utils/noiseUtils.js";

test("buildNoiseAugmentedGraph injects noise nodes and parents", () => {
  const eqs = new Map([
    ["A", new Set()],
    ["B", new Set(["A"])],
  ]);
  const allVars = new Set(["A", "B"]);

  const { eqs: nextEqs, allVars: nextVars, noiseNodes } = buildNoiseAugmentedGraph(eqs, allVars);

  const noiseA = buildNoiseId("A");
  const noiseB = buildNoiseId("B");

  assert.ok(nextVars.has(noiseA));
  assert.ok(nextVars.has(noiseB));
  assert.ok(noiseNodes.has(noiseA));
  assert.ok(noiseNodes.has(noiseB));
  assert.ok(nextEqs.get("A").has(noiseA));
  assert.ok(nextEqs.get("B").has(noiseB));
  assert.equal(nextEqs.get(noiseA).size, 0);
  assert.equal(nextEqs.get(noiseB).size, 0);
});

test("noise id helpers map identifiers consistently", () => {
  const noiseId = buildNoiseId("X");
  assert.ok(isNoiseId(noiseId));
  assert.equal(getNoiseTargetId(noiseId), "X");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getUserVariables,
  generateSamples,
  samplesToCSV,
  findRootNodes,
} from "../../src/utils/csvSimulation.js";
import { buildNoiseId } from "../../src/utils/noiseUtils.js";

test("getUserVariables filters out noise nodes", () => {
  const allVars = new Set(["A", "B", "noise:A", "noise:B"]);
  const result = getUserVariables(allVars);
  assert.deepEqual(result, ["A", "B"]);
});

test("getUserVariables returns sorted variables", () => {
  const allVars = new Set(["Z", "A", "M"]);
  const result = getUserVariables(allVars);
  assert.deepEqual(result, ["A", "M", "Z"]);
});

test("getUserVariables handles empty input", () => {
  assert.deepEqual(getUserVariables(new Set()), []);
  assert.deepEqual(getUserVariables(null), []);
  assert.deepEqual(getUserVariables(undefined), []);
});

test("samplesToCSV generates valid CSV with header", () => {
  const samples = [
    { A: 1, B: 2 },
    { A: 3, B: 4 },
  ];
  const csv = samplesToCSV(samples, ["A", "B"]);
  assert.equal(csv, "A,B\n1,2\n3,4");
});

test("samplesToCSV handles empty samples", () => {
  assert.equal(samplesToCSV([], ["A"]), "");
});

test("samplesToCSV handles empty columns", () => {
  assert.equal(samplesToCSV([{ A: 1 }], []), "");
});

test("samplesToCSV replaces NaN/Infinity with empty string", () => {
  const samples = [
    { A: 1, B: NaN, C: Infinity },
    { A: 2, B: -Infinity, C: 3 },
  ];
  const csv = samplesToCSV(samples, ["A", "B", "C"]);
  assert.equal(csv, "A,B,C\n1,,\n2,,3");
});

test("findRootNodes identifies nodes with no causal parents", () => {
  const eqs = new Map([
    ["A", new Set()], // Root - no parents
    ["B", new Set(["A"])], // Has parent A
    ["C", new Set()], // Root - no parents
  ]);
  const roots = findRootNodes(eqs);
  assert.deepEqual(roots.sort(), ["A", "C"]);
});

test("findRootNodes ignores noise nodes as parents", () => {
  const noiseA = buildNoiseId("A");
  const eqs = new Map([
    ["A", new Set([noiseA])], // Only noise parent - still a root
    ["B", new Set(["A", buildNoiseId("B")])], // Has real parent A
    [noiseA, new Set()],
  ]);
  const roots = findRootNodes(eqs);
  assert.deepEqual(roots, ["A"]);
});

test("generateSamples varies root nodes when noise disabled", () => {
  // Simple model: B depends on A (root)
  const model = new Map([
    ["A", { ast: null, dependencies: new Set() }],
    ["B", { ast: { type: "Identifier", name: "A" }, dependencies: new Set(["A"]) }],
  ]);
  const eqs = new Map([
    ["A", new Set()],
    ["B", new Set(["A"])],
  ]);
  const allVars = new Set(["A", "B"]);
  const values = { A: 10, B: 10 };
  const interventions = {};
  const ranges = { A: { min: 0, max: 100 }, B: { min: 0, max: 100 } };
  const noiseConfig = { enabled: false, amount: 0 };

  const samples = generateSamples({
    model,
    eqs,
    allVars,
    values,
    interventions,
    ranges,
    noiseConfig,
    sampleCount: 100,
  });

  assert.equal(samples.length, 100);
  // Root node A should vary uniformly - samples should NOT all be identical
  const uniqueA = new Set(samples.map((s) => s.A));
  assert.ok(uniqueA.size > 1, "Expected varying values for root node A");
  // B should also vary since it depends on A
  const uniqueB = new Set(samples.map((s) => s.B));
  assert.ok(uniqueB.size > 1, "Expected varying values for dependent node B");
});

test("generateSamples respects do() interventions", () => {
  // B = A, but A is clamped to 50 via intervention
  const model = new Map([
    ["A", { ast: null, dependencies: new Set() }],
    ["B", { ast: { type: "Identifier", name: "A" }, dependencies: new Set(["A"]) }],
  ]);
  // Add noise nodes to match real augmented graph
  const noiseA = buildNoiseId("A");
  const noiseB = buildNoiseId("B");
  const eqs = new Map([
    ["A", new Set([noiseA])],
    ["B", new Set(["A", noiseB])],
    [noiseA, new Set()],
    [noiseB, new Set()],
  ]);
  const allVars = new Set(["A", "B", noiseA, noiseB]);
  const values = { A: 50, B: 50 };
  const interventions = { A: true }; // A is intervened on
  const ranges = { A: { min: 0, max: 100 }, B: { min: 0, max: 100 } };
  const noiseConfig = { enabled: true, amount: 0.1 };

  const samples = generateSamples({
    model,
    eqs,
    allVars,
    values,
    interventions,
    ranges,
    noiseConfig,
    sampleCount: 10,
  });

  // A should stay at 50 for all samples because it's clamped
  samples.forEach((s) => assert.equal(s.A, 50));
  // Samples should only include user variables, not noise nodes
  samples.forEach((s) => {
    assert.ok(!Object.hasOwn(s, noiseA));
    assert.ok(!Object.hasOwn(s, noiseB));
  });
});

test("generateSamples clamps computed values to ranges", () => {
  // B = 2 * A, where A is a root that varies 0-100, so B could exceed its range
  const model = new Map([
    ["A", { ast: null, dependencies: new Set() }],
    ["B", { ast: { type: "BinaryExpression", operator: "*", left: { type: "Literal", value: 2 }, right: { type: "Identifier", name: "A" } }, dependencies: new Set(["A"]) }],
  ]);
  const eqs = new Map([
    ["A", new Set()],
    ["B", new Set(["A"])],
  ]);
  const allVars = new Set(["A", "B"]);
  const values = { A: 50, B: 100 };
  const ranges = { A: { min: 0, max: 100 }, B: { min: 0, max: 50 } }; // B max is 50

  const samples = generateSamples({
    model,
    eqs,
    allVars,
    values,
    interventions: {},
    ranges,
    noiseConfig: { enabled: false },
    sampleCount: 100,
  });

  // All B values should be clamped to max 50
  samples.forEach((s) => {
    assert.ok(s.B <= 50, `B value ${s.B} should be clamped to max 50`);
    assert.ok(s.B >= 0, `B value ${s.B} should be >= 0`);
  });
});

test("generateSamples uses default range when none specified", () => {
  const model = new Map([["A", { ast: null, dependencies: new Set() }]]);
  const eqs = new Map([["A", new Set()]]);
  const allVars = new Set(["A"]);
  const values = { A: 50 };

  const samples = generateSamples({
    model,
    eqs,
    allVars,
    values,
    interventions: {},
    ranges: {}, // No range defined - should use default [-100, 100]
    noiseConfig: { enabled: false },
    sampleCount: 100,
  });

  // A is a root node, so it should vary within default range [-100, 100]
  const uniqueA = new Set(samples.map((s) => s.A));
  assert.ok(uniqueA.size > 1, "Expected varying values for root node A");
  samples.forEach((s) => {
    assert.ok(s.A >= -100 && s.A <= 100, `A value ${s.A} should be in default range [-100, 100]`);
  });
});

test("generateSamples produces varying output when noise enabled", () => {
  const model = new Map([["A", { ast: null, dependencies: new Set() }]]);
  const noiseA = buildNoiseId("A");
  const eqs = new Map([
    ["A", new Set([noiseA])],
    [noiseA, new Set()],
  ]);
  const allVars = new Set(["A", noiseA]);
  const values = { A: 50 };
  const ranges = { A: { min: 0, max: 100 } };
  const noiseConfig = { enabled: true, amount: 0.1 };

  const samples = generateSamples({
    model,
    eqs,
    allVars,
    values,
    interventions: {},
    ranges,
    noiseConfig,
    sampleCount: 100,
  });

  // With noise, samples should vary
  const uniqueValues = new Set(samples.map((s) => s.A));
  // Should have more than 1 unique value (very likely with 100 samples and 10% noise)
  assert.ok(uniqueValues.size > 1, "Expected varying values with noise enabled");
});

test("generateSamples varies constant root nodes with literal AST (regression)", () => {
  // Model with X = 5 (constant literal AST) - this is how real SCM parsing works
  // Previously this would fail because computeValues would overwrite random values
  const model = new Map([
    [
      "X",
      {
        ast: { type: "Literal", value: 5 },
        dependencies: new Set(),
        source: "5",
        derived: false,
      },
    ],
    [
      "Y",
      {
        ast: { type: "Identifier", name: "X" },
        dependencies: new Set(["X"]),
        source: "X",
        derived: false,
      },
    ],
  ]);
  const eqs = new Map([
    ["X", new Set()],
    ["Y", new Set(["X"])],
  ]);
  const allVars = new Set(["X", "Y"]);
  const values = { X: 5, Y: 5 };
  const ranges = { X: { min: 0, max: 100 }, Y: { min: 0, max: 100 } };

  const samples = generateSamples({
    model,
    eqs,
    allVars,
    values,
    interventions: {},
    ranges,
    noiseConfig: { enabled: false },
    sampleCount: 100,
  });

  // X should vary even though its AST is a literal constant
  const uniqueX = new Set(samples.map((s) => s.X));
  assert.ok(uniqueX.size > 1, "Root node X should vary despite literal AST");

  // Y should vary because it depends on X (Y = X)
  const uniqueY = new Set(samples.map((s) => s.Y));
  assert.ok(uniqueY.size > 1, "Dependent Y should vary with X");

  // Verify Y equals X for each sample (since Y = X)
  samples.forEach((s) => {
    assert.equal(s.Y, s.X, `Y should equal X, got Y=${s.Y}, X=${s.X}`);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEdgeDsepMap } from "../../src/graph/dseparation.js";

function makeEqs(entries) {
  return new Map(entries.map(([child, parents]) => [child, new Set(parents)]));
}

test("confounder path blocking marks edges good", () => {
  const eqs = makeEqs([
    ["X", ["Z"]],
    ["Y", ["Z"]],
    ["Z", []],
  ]);
  const result = computeEdgeDsepMap({ eqs, x: "X", y: "Y", controls: ["Z"] });

  assert.equal(result.get("Z->X"), "good");
  assert.equal(result.get("Z->Y"), "good");
});

test("mediator blocking marks edges maybe", () => {
  const eqs = makeEqs([
    ["Z", ["X"]],
    ["Y", ["Z"]],
    ["X", []],
  ]);
  const result = computeEdgeDsepMap({ eqs, x: "X", y: "Y", controls: ["Z"] });

  assert.equal(result.get("X->Z"), "maybe");
  assert.equal(result.get("Z->Y"), "maybe");
});

test("collider conditioning marks edges bad", () => {
  const eqs = makeEqs([
    ["Z", ["X", "Y"]],
    ["X", []],
    ["Y", []],
  ]);
  const result = computeEdgeDsepMap({ eqs, x: "X", y: "Y", controls: ["Z"] });

  assert.equal(result.get("X->Z"), "bad");
  assert.equal(result.get("Y->Z"), "bad");
});

test("collider descendant conditioning marks edges bad", () => {
  const eqs = makeEqs([
    ["Z", ["X", "Y"]],
    ["W", ["Z"]],
    ["X", []],
    ["Y", []],
  ]);
  const result = computeEdgeDsepMap({ eqs, x: "X", y: "Y", controls: ["W"] });

  assert.equal(result.get("X->Z"), "bad");
  assert.equal(result.get("Y->Z"), "bad");
});

test("bad overrides maybe on shared edges", () => {
  const eqs = makeEqs([
    ["A", ["X", "B"]],
    ["Y", ["A", "B"]],
    ["X", []],
    ["B", []],
  ]);
  const result = computeEdgeDsepMap({ eqs, x: "X", y: "Y", controls: ["A"] });

  assert.equal(result.get("X->A"), "bad");
});

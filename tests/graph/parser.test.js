import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSCM } from "../../src/graph/parser.js";

const SAMPLE_SCM = `
Y = 2*X + 3 + error
X = error
`;

test("parseSCM extracts coefficients and constants", () => {
  const { model, allVars } = parseSCM(SAMPLE_SCM);

  assert.ok(model instanceof Map);
  assert.deepEqual([...allVars].sort(), ["X", "Y"]);

  const ySpec = model.get("Y");
  assert.deepEqual(ySpec.parents, { X: 2 });
  assert.equal(ySpec.constant, 3);

  const xSpec = model.get("X");
  assert.deepEqual(xSpec.parents, {});
  assert.equal(xSpec.constant, 0);
});

test("parseSCM throws for malformed lines", () => {
  assert.throws(() => parseSCM("not-valid"), /Cannot parse/);
});

test("parseSCM prevents duplicate declarations", () => {
  const duplicate = "A = 1\nA = 2";
  assert.throws(() => parseSCM(duplicate), /Duplicate/);
});

test("parseSCM hoists parent-only variables and merges repeated parents", () => {
  const input = "Y = X + 0.5*X + 3; Z = 2*Y";
  const { model, allVars } = parseSCM(input);

  assert.ok(allVars.has("X"), "parent-only variable should be hoisted");
  const ySpec = model.get("Y");
  assert.deepEqual(ySpec.parents, { X: 1.5 });
  assert.equal(ySpec.constant, 3);
  const xSpec = model.get("X");
  assert.deepEqual(xSpec.parents, {});
  assert.equal(xSpec.constant, 0);
});

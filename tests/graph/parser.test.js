import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSCM } from "../../src/graph/parser.js";

const SAMPLE_SCM = `
Y = 2*X + 3 + error
X = error
`;

test("parseSCM builds AST-backed entries with dependency metadata", () => {
  const { model, allVars } = parseSCM(SAMPLE_SCM);

  assert.ok(model instanceof Map);
  assert.deepEqual([...allVars].sort(), ["X", "Y"]);

  const ySpec = model.get("Y");
  assert.equal(ySpec.source, "2*X + 3 + error");
  assert.equal(ySpec.ast.type, "BinaryExpression");
  assert.deepEqual([...ySpec.dependencies].sort(), ["X"]);
  assert.equal(ySpec.derived, false);

  const xSpec = model.get("X");
  assert.equal(xSpec.ast.type, "Identifier");
  assert.deepEqual([...xSpec.dependencies], []);
  assert.equal(xSpec.derived, false);
});

test("parseSCM throws for malformed lines", () => {
  assert.throws(() => parseSCM("not-valid"), /Cannot parse/);
});

test("parseSCM prevents duplicate declarations", () => {
  const duplicate = "A = 1\nA = 2";
  assert.throws(() => parseSCM(duplicate), /Duplicate/);
});

test("parseSCM hoists dependency-only symbols as derived nodes", () => {
  const input = "Y = X + 0.5*X + 3; Z = 2*Y";
  const { model, allVars } = parseSCM(input);

  assert.ok(allVars.has("X"), "parent-only variable should be hoisted");
  const ySpec = model.get("Y");
  assert.deepEqual([...ySpec.dependencies], ["X"]);

  const xSpec = model.get("X");
  assert.equal(xSpec.derived, true);
  assert.equal(xSpec.ast, null);
  assert.deepEqual([...xSpec.dependencies], []);
});

test("parseSCM accepts whitelisted math helpers", () => {
  const input = "Y = exp(X) + log(abs(-2))";
  const { model } = parseSCM(input);
  const ySpec = model.get("Y");
  assert.deepEqual([...ySpec.dependencies], ["X"]);
});

test("parseSCM rejects unsupported functions", () => {
  assert.throws(() => parseSCM("Y = foo(X)"), /not allowed/i);
});

test("parseSCM rejects removed helpers such as min/max", () => {
  assert.throws(() => parseSCM("Y = min(X, 1)"), /not allowed/i);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import jsep from "jsep";
import { ensureExpressionParserConfigured } from "../../src/graph/expressionRegistry.js";
import { evaluateExpression } from "../../src/graph/interpreter.js";

ensureExpressionParserConfigured();

function evalExpr(expression, scope = {}) {
  const ast = jsep(expression);
  return evaluateExpression(ast, scope);
}

test("evaluateExpression supports arithmetic, functions, and precedence", () => {
  const scope = { X: 2, Y: -3 };
  const value = evalExpr("sin(X) + log(exp(X)) - abs(Y)", scope);
  assert.equal(value, Math.sin(2) + Math.log(Math.exp(2)) - Math.abs(-3));
});

test("evaluateExpression covers logical operators and conditionals", () => {
  const scope = { X: 2, Y: -1 };
  const value = evalExpr("X > 0 && Y < 0 ? X ^ 2 : 0", scope);
  assert.equal(value, 4);
});

test("evaluateExpression throws when referencing unknown identifiers", () => {
  assert.throws(() => evalExpr("foo + 1", {}), /Unknown variable/);
});

test("evaluateExpression exposes the special error identifier", () => {
  const value = evalExpr("error + 5", { error: 0 });
  assert.equal(value, 5);
});

test("evaluateExpression rejects removed helpers such as min", () => {
  assert.throws(() => evalExpr("min(1, 2)"), /not allowed/i);
});

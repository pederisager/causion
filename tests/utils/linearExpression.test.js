import { describe, expect, test } from "vitest";
import jsep from "jsep";
import { ensureExpressionParserConfigured } from "../../src/graph/expressionRegistry.js";
import {
  buildLinearExpression,
  getLinearSummary,
  updateLinearCoefficient,
} from "../../src/utils/linearExpression.js";

describe("linearExpression utilities", () => {
  test("extracts linear coefficients from a simple expression", () => {
    ensureExpressionParserConfigured();
    const ast = jsep("2*A + 3*B - 1");
    const summary = getLinearSummary(ast);
    expect(summary).not.toBeNull();
    expect(summary.terms.get("A")).toBe(2);
    expect(summary.terms.get("B")).toBe(3);
    expect(summary.constant).toBe(-1);
  });

  test("returns null for non-linear terms", () => {
    ensureExpressionParserConfigured();
    const ast = jsep("A * B");
    const summary = getLinearSummary(ast);
    expect(summary).toBeNull();
  });

  test("builds expression after coefficient update", () => {
    ensureExpressionParserConfigured();
    const ast = jsep("A + 2*B");
    const summary = getLinearSummary(ast);
    const updated = updateLinearCoefficient(summary, "A", 0.5);
    const next = buildLinearExpression(updated);
    expect(next).toBe("0.5*A + 2*B");
  });
});

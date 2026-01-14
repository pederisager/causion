import { describe, it, expect } from "vitest";
import { computeDeterministicValues, wouldCreateCycle } from "../../src/graph/dagMath.js";

describe("dagMath", () => {
  it("computes deterministic values in topological order", () => {
    const nodes = [
      { id: "A", data: { sliderValue: 3, value: 0, isLocked: false, bias: 0 } },
      { id: "B", data: { sliderValue: 0, value: 0, isLocked: false, bias: 0 } },
    ];
    const edges = [
      { id: "A->B", source: "A", target: "B", data: { weight: 2 } },
    ];

    const values = computeDeterministicValues(nodes, edges);
    expect(values.A).toBe(3);
    expect(values.B).toBe(6);
  });

  it("respects do-lock on endogenous nodes", () => {
    const nodes = [
      { id: "A", data: { sliderValue: 4, value: 0, isLocked: false, bias: 0 } },
      { id: "B", data: { sliderValue: 5, value: 0, isLocked: true, bias: 0 } },
    ];
    const edges = [
      { id: "A->B", source: "A", target: "B", data: { weight: 1 } },
    ];

    const values = computeDeterministicValues(nodes, edges);
    expect(values.A).toBe(4);
    expect(values.B).toBe(5);
  });

  it("detects cycles when adding edges", () => {
    const edges = [
      { id: "A->B", source: "A", target: "B", data: { weight: 1 } },
      { id: "B->C", source: "B", target: "C", data: { weight: 1 } },
    ];

    expect(wouldCreateCycle("C", "A", edges)).toBe(true);
    expect(wouldCreateCycle("A", "C", edges)).toBe(false);
  });
});

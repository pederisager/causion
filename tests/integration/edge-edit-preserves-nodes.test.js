import { describe, expect, test } from "vitest";
import {
  addNodeToScm,
  upsertEdgeCoefficient,
} from "../../src/graph/scmMutations.js";

describe("edge editing preserves unrelated nodes", () => {
  test("editing an edge after creating a new node preserves the new node", () => {
    // Start with a basic DAG
    let scmText = "X = 0\nY = X\nZ = Y";

    // User creates a new node W
    scmText = addNodeToScm(scmText, "W");
    expect(scmText).toBe("X = 0\nY = X\nZ = Y\nW = 0");

    // User edits the edge X->Y coefficient
    scmText = upsertEdgeCoefficient(scmText, "X", "Y", 2, { requireExistingTerm: true });

    // The new node W should still be present
    expect(scmText).toContain("W = 0");
    expect(scmText.split("\n")).toHaveLength(4);
  });

  test("editing an edge after creating a new edge preserves all nodes", () => {
    // Start with a basic DAG
    let scmText = "X = 0\nY = X";

    // User creates a new edge W->Y
    scmText = upsertEdgeCoefficient(scmText, "W", "Y", 1);
    expect(scmText).toContain("W");
    const linesAfterEdge = scmText.split("\n");

    // User edits the existing edge X->Y coefficient
    scmText = upsertEdgeCoefficient(scmText, "X", "Y", 2, { requireExistingTerm: true });

    // All nodes should still be present
    const finalLines = scmText.split("\n");
    expect(finalLines.length).toBe(linesAfterEdge.length);
    expect(scmText).toContain("W");
    expect(scmText).toContain("X");
    expect(scmText).toContain("Y");
  });
});

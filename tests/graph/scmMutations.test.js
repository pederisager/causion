import { describe, expect, test } from "vitest";
import {
  addNodeToScm,
  removeEdgeFromScm,
  renameNodeInScm,
  removeNodeFromScm,
  upsertEdgeCoefficient,
} from "../../src/graph/scmMutations.js";

describe("scmMutations", () => {
  test("adds a new node with default equation", () => {
    const text = "A = 1";
    const next = addNodeToScm(text, "B");
    expect(next).toBe("A = 1\nB = 0");
  });

  test("upserts a linear edge coefficient", () => {
    const text = "Y = 2*A + 1";
    const next = upsertEdgeCoefficient(text, "B", "Y", 3);
    expect(next).toBe("Y = 2*A + 3*B + 1");
  });

  test("renames a node and updates references", () => {
    const text = "A = 1\nB = A + 2*A\nC = B + 1";
    const next = renameNodeInScm(text, "A", "X");
    expect(next).toBe("X = 1\nB = X + 2*X\nC = B + 1");
  });

  test("renames derived identifiers referenced in equations", () => {
    const text = "A = B + 1\nC = A + B";
    const next = renameNodeInScm(text, "B", "D");
    expect(next).toBe("A = D + 1\nC = A + D");
  });

  test("rejects renaming to an existing node", () => {
    const text = "A = 1\nB = A + 2";
    expect(() => renameNodeInScm(text, "A", "B")).toThrow();
  });

  test("rejects edits when the term is missing and required", () => {
    const text = "Y = 2*A + 1";
    expect(() => upsertEdgeCoefficient(text, "B", "Y", 3, { requireExistingTerm: true })).toThrow();
  });

  test("removes a node and prunes linear references", () => {
    const text = "A = 1\nB = 2*A + 3\nC = B + A";
    const next = removeNodeFromScm(text, "A");
    expect(next).toBe("B = 3\nC = B");
  });

  test("removes a linear edge coefficient", () => {
    const text = "Y = 2*A + 3*B + 1";
    const next = removeEdgeFromScm(text, "A", "Y");
    expect(next).toBe("Y = 3*B + 1\nA = 0");
  });

  test("removes a nonlinear edge by zeroing the identifier", () => {
    const text = "Y = sin(A) + 2";
    const next = removeEdgeFromScm(text, "A", "Y");
    expect(next).toBe("Y = sin(0) + 2\nA = 0");
  });

  test("removes derived nodes by stripping references", () => {
    const text = "A = B + 1\nC = A + B";
    const next = removeNodeFromScm(text, "B");
    expect(next).toBe("A = 1\nC = A");
  });

  test("removes references from non-linear expressions", () => {
    const text = "A = sin(B) + 2\nC = A + 1";
    const next = removeNodeFromScm(text, "B");
    expect(next).toBe("A = sin(0) + 2\nC = A + 1");
  });

  test("preserves derived parents when removing their only child", () => {
    const text = "M = X + 1\nY = M + 2";
    const next = removeNodeFromScm(text, "M");
    expect(next).toBe("Y = 2\nX = 0");
  });

  test("preserves multiple parent-only nodes when removing a collider", () => {
    const text = "C = X + Y";
    const next = removeNodeFromScm(text, "C");
    expect(next).toBe("X = 0\nY = 0");
  });
});

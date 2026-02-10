import { describe, it, expect } from "vitest";
import { __TEST_ONLY__ } from "../../src/utils/dagImageExport.js";

const { computeNodeBounds, buildDagImageFilename } = __TEST_ONLY__;

describe("dagImageExport", () => {
  it("computes tight bounds that hug outermost DAG nodes", () => {
    const nodes = [
      { id: "X", position: { x: -120, y: 20 } },
      { id: "Y", position: { x: 260, y: 180 }, measured: { width: 160, height: 140 } },
      { id: "noise:X", type: "noise", position: { x: -200, y: 100 } },
    ];

    const bounds = computeNodeBounds(nodes);

    expect(bounds.minX).toBe(-200);
    expect(bounds.minY).toBe(20);
    expect(bounds.width).toBe(620);
    expect(bounds.height).toBe(300);
  });

  it("generates a timestamped PNG filename", () => {
    const filename = buildDagImageFilename("dag export", new Date("2026-02-10T14:23:45Z"));
    expect(filename).toMatch(/^dag-export-\d{8}-\d{6}\.png$/);
  });
});

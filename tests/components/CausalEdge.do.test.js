import React from "react";
import { describe, it, expect } from "vitest";
import CausalEdge from "../../src/components/edges/CausalEdge.js";

const defaultEdgeProps = {
  id: "edge-do",
  sourceX: 0,
  sourceY: 0,
  targetX: 80,
  targetY: 0,
};

const renderEdge = (props) =>
  renderWithProviders(
    React.createElement(
      "svg",
      { "data-testid": "edge-canvas" },
      React.createElement(CausalEdge, { ...defaultEdgeProps, ...props })
    )
  );

describe("CausalEdge with do() on target", () => {
  it("ghosts the edge and suppresses marching ants even if hot", () => {
    const { container } = renderEdge({
      data: { hot: true, disabledByDo: true, pulseMs: 600, stylePreset: "minimal" },
    });

    // No marching ants path should be present
    const animatedPath = container.querySelector('path[stroke-dasharray="8 8"]');
    expect(animatedPath).toBeNull();

    // Base path and marker should both be muted
    const base = container.querySelector('path[stroke="#cbd5e1"]');
    expect(base).toBeTruthy();
    expect(base?.getAttribute("opacity")).toBe("0.38");

    const marker = container.querySelector('marker path[fill="#cbd5e1"]');
    expect(marker).toBeTruthy();
    expect(marker?.getAttribute("opacity")).toBe("0.2");
  });
});

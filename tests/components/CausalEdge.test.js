import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import CausalEdge from "../../src/components/edges/CausalEdge.js";

describe("CausalEdge", () => {
  const renderEdge = (props) =>
    render(
      React.createElement(
        "svg",
        { "data-testid": "edge-canvas" },
        React.createElement(CausalEdge, props)
      )
    );

  it("applies marching ants style when hot", () => {
    const { container } = renderEdge({
      id: "edge-1",
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      data: { hot: true, pulseMs: 900 },
    });

    const animatedPath = container.querySelector('path[stroke-dasharray="8 8"]');
    expect(animatedPath).toBeInTheDocument();
    expect(animatedPath?.style.animation).toContain("antsForward");
  });

  it("omits marching ants when edge is idle", () => {
    const { container } = renderEdge({
      id: "edge-2",
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      data: { hot: false, pulseMs: 900 },
    });

    const animatedPath = container.querySelector('path[stroke-dasharray="8 8"]');
    expect(animatedPath).toBeNull();
  });
});

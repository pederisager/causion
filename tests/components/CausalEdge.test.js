import React from "react";
import { describe, it, expect } from "vitest";
import CausalEdge from "../../src/components/edges/CausalEdge.js";

const defaultEdgeProps = {
  id: "edge-1",
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
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

describe("CausalEdge", () => {
  it("renders marching ants animation with default timing when hot", () => {
    const { container } = renderEdge({
      data: { hot: true },
    });

    const animatedPath = container.querySelector('path[stroke-dasharray="8 8"]');
    expect(animatedPath).toBeInTheDocument();
    expect(animatedPath.style.animation).toContain("antsForward");
    expect(animatedPath.getAttribute("style")).toMatchInlineSnapshot(
      '"animation: antsForward 1s linear infinite;"'
    );
  });

  it("keeps the marching ants animation after toggling the hot flag", () => {
    const view = renderEdge({ data: { hot: true, pulseMs: 600 } });

    let animatedPath = view.container.querySelector('path[stroke-dasharray="8 8"]');
    expect(animatedPath).toBeInTheDocument();
    expect(animatedPath.style.animation).toContain("antsForward");

    view.rerender(
      React.createElement(
        "svg",
        { "data-testid": "edge-canvas" },
        React.createElement(CausalEdge, {
          ...defaultEdgeProps,
          data: { hot: false, pulseMs: 600 },
        })
      )
    );

    animatedPath = view.container.querySelector('path[stroke-dasharray="8 8"]');
    expect(animatedPath).toBeNull();

    view.rerender(
      React.createElement(
        "svg",
        { "data-testid": "edge-canvas" },
        React.createElement(CausalEdge, {
          ...defaultEdgeProps,
          data: { hot: true, pulseMs: 600 },
        })
      )
    );

    animatedPath = view.container.querySelector('path[stroke-dasharray="8 8"]');
    expect(animatedPath).toBeInTheDocument();
    expect(animatedPath.style.animation).toContain("antsForward");
  });
});

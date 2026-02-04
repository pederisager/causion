import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
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

  it("enters edit mode on click and commits a new coefficient", () => {
    const onEdgeCoefficientCommit = vi.fn();
    renderEdge({
      data: {
        effectLabel: "2",
        edgeCoefficient: 2,
        allowLabelEdit: true,
        showLabel: true,
        onEdgeCoefficientCommit,
      },
    });

    fireEvent.click(screen.getByText("2"));

    const input = screen.getByDisplayValue("2");
    fireEvent.change(input, { target: { value: "3.5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEdgeCoefficientCommit).toHaveBeenCalledWith("edge-1", 3.5);
  });

  it("uses d-separation color when provided", () => {
    const { container } = renderEdge({
      data: { dsepColor: "var(--edge-color-bad)" },
    });

    const coloredPath = container.querySelector('path[stroke="var(--edge-color-bad)"]');
    expect(coloredPath).toBeInTheDocument();
  });

  it("shows the formula when the edge is selected", () => {
    renderEdge({
      selected: true,
      data: {
        effectLabel: "A",
        edgeCoefficient: 1,
        allowLabelEdit: true,
      },
    });

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders a highlight halo when selected", () => {
    const { container } = renderEdge({
      selected: true,
      data: { hot: false },
    });

    const haloPath = container.querySelector('path[stroke="rgba(148, 163, 184, 0.45)"]');
    expect(haloPath).toBeInTheDocument();
  });

  it("renders a wider hitbox path for easier selection", () => {
    const { container } = renderEdge({
      interactionWidth: 24,
      data: { hot: false },
    });

    const hitbox = container.querySelector('[data-edge-hitbox="true"]');
    expect(hitbox).toBeInTheDocument();
    expect(hitbox.getAttribute("pointer-events")).toBe("stroke");
    expect(hitbox.getAttribute("stroke-width")).toBe("24");
  });
});

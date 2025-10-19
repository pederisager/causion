import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen, within, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, reactFlowBridgeStub } from "../setup/test-env.js";
import { __TEST_ONLY__ as AppTestUtils } from "../../src/App.js";

function createFlowHarness() {
  const FlowHarness = ({ edges = [], edgeTypes = {}, children }) => {
    const edgeElements = edges
      .map((edge) => {
        const EdgeComponent = edgeTypes?.[edge.type];
        if (!EdgeComponent) return null;
        return React.createElement(EdgeComponent, {
          key: edge.id,
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          markerEnd: edge.markerEnd,
          data: edge.data,
          sourceX: 0,
          sourceY: 0,
          targetX: 160,
          targetY: 0,
        });
      })
      .filter(Boolean);

    const childArray = React.Children.toArray(children);

    return React.createElement(
      "div",
      { "data-testid": "rf-harness" },
      React.createElement("svg", { "data-testid": "rf-edges" }, ...edgeElements),
      ...childArray
    );
  };

  return FlowHarness;
}

describe("Slider clamp integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("releases ephemeral clamps and preserves explicit clamps while keeping marching-ants edges", async () => {
    const FlowHarness = createFlowHarness();
    const bridge = { ...reactFlowBridgeStub, ReactFlow: FlowHarness };
    const { createApp } = AppTestUtils;
    const { App } = createApp(bridge);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(React.createElement(App), { bridge });

    const sliderLabel = await screen.findByText(/^A:/i);
    const sliderRow = sliderLabel.closest("div").parentElement;
    if (!sliderRow) {
      throw new Error("Failed to locate slider row for variable A");
    }

    // Value label uses the span.opacity-70 inside the slider row (defined in src/App.js).
    const getValueLabel = () => sliderRow.querySelector("span.opacity-70");
    const slider = within(sliderRow).getByRole("slider");
    const clampToggle = within(sliderRow).getByRole("checkbox", { name: /clamp \(do\)/i });

    expect(getValueLabel()).toHaveTextContent("0.00");
    expect(clampToggle).not.toBeChecked();
    expect(sliderRow).toHaveClass("mb-4");
    expect(sliderRow).not.toHaveClass("is-clamped");

    await user.pointer([{ target: slider, keys: "[MouseLeft]" }]);
    fireEvent.input(slider, { target: { value: "30" } });

    await waitFor(() => {
      expect(slider).toHaveValue("30");
      expect(getValueLabel()).toHaveTextContent("30.00");
    });

    await user.pointer([{ target: slider, keys: "[/MouseLeft]" }]);

    await waitFor(() => {
      expect(getValueLabel()).toHaveTextContent("0.00");
      expect(clampToggle).not.toBeChecked();
    });

    expect(sliderRow.className).toBe("mb-4");

    await act(() => {
      vi.advanceTimersByTime(600);
    });

    await waitFor(() => {
      const antsPath = document.querySelector('path[stroke-dasharray="8 8"]');
      expect(antsPath).toBeTruthy();
    });

    await user.click(clampToggle);
    await waitFor(() => expect(clampToggle).toBeChecked());

    await user.pointer([{ target: slider, keys: "[MouseLeft]" }]);
    fireEvent.input(slider, { target: { value: "25" } });

    await waitFor(() => {
      expect(slider).toHaveValue("25");
      expect(getValueLabel()).toHaveTextContent("25.00");
    });

    await user.pointer([{ target: slider, keys: "[/MouseLeft]" }]);

    await waitFor(() => {
      expect(getValueLabel()).toHaveTextContent("25.00");
    });

    expect(clampToggle).toBeChecked();
  });
});

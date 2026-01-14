import React from "react";
import { describe, it, expect } from "vitest";
import { screen, within, waitFor, fireEvent } from "@testing-library/react";
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
  it("releases ephemeral clamps and preserves explicit clamps while keeping marching-ants edges", async () => {
    const FlowHarness = createFlowHarness();
    const bridge = { ...reactFlowBridgeStub, ReactFlow: FlowHarness };
    const { createApp } = AppTestUtils;
    const { App } = createApp(bridge);
    const user = userEvent.setup();

    renderWithProviders(React.createElement(App), { bridge });

    const advancedToggle = await screen.findByRole("button", { name: /advanced functions/i });
    fireEvent.click(advancedToggle);

    await waitFor(() => {
      expect(document.querySelectorAll("[data-causion-slider]").length).toBeGreaterThan(0);
    });
    const sliderRow = document.querySelectorAll("[data-causion-slider]")[0];
    if (!sliderRow) {
      throw new Error("Failed to locate a slider row");
    }

    // Value label uses the span.opacity-70 inside the slider row (defined in src/App.js).
    const getValueLabel = () => sliderRow.querySelector("span.opacity-70");
    const sliderInRow = within(sliderRow).getByRole("slider");
    const clampToggle = within(sliderRow).getByRole("button", { name: /do\(\) clamp/i });

    expect(getValueLabel()).toHaveTextContent("0.00");
    expect(clampToggle).toHaveAttribute("aria-pressed", "false");
    expect(sliderRow).toHaveClass("mb-4");
    expect(sliderRow).not.toHaveClass("is-clamped");
    fireEvent.mouseDown(sliderInRow);
    fireEvent.input(sliderInRow, { target: { value: "30" } });

    await waitFor(() => {
      expect(sliderInRow).toHaveValue("30");
      expect(getValueLabel()).toHaveTextContent("30.00");
    });

    fireEvent.mouseUp(sliderInRow);

    await waitFor(() => {
      expect(getValueLabel()).toHaveTextContent("0.00");
      expect(clampToggle).toHaveAttribute("aria-pressed", "false");
    });

    expect(sliderRow.className).toBe("mb-4");

    await waitFor(
      () => {
        const antsPath = document.querySelector('path[stroke-dasharray="8 8"]');
        expect(antsPath).toBeTruthy();
      },
      { timeout: 2000 }
    );

    await user.click(clampToggle);
    await waitFor(() =>
      expect(clampToggle).toHaveAttribute("aria-pressed", "true")
    );

    fireEvent.mouseDown(sliderInRow);
    fireEvent.input(sliderInRow, { target: { value: "25" } });

    await waitFor(() => {
      expect(sliderInRow).toHaveValue("25");
      expect(getValueLabel()).toHaveTextContent("25.00");
    });

    fireEvent.mouseUp(sliderInRow);

    await waitFor(() => {
      expect(getValueLabel()).toHaveTextContent("25.00");
    });

    expect(clampToggle).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps autoplay active when mouseup fires without a slider drag", async () => {
    const FlowHarness = createFlowHarness();
    const bridge = { ...reactFlowBridgeStub, ReactFlow: FlowHarness };
    const { createApp } = AppTestUtils;
    const { App } = createApp(bridge);
    const user = userEvent.setup();

    renderWithProviders(React.createElement(App), { bridge });

    const advancedToggle = await screen.findByRole("button", { name: /advanced functions/i });
    fireEvent.click(advancedToggle);

    await waitFor(() => {
      expect(document.querySelectorAll("[data-causion-slider]").length).toBeGreaterThan(0);
    });
    const sliderRow = document.querySelectorAll("[data-causion-slider]")[0];
    if (!sliderRow) {
      throw new Error("Failed to locate a slider row");
    }

    const sliderInRow = within(sliderRow).getByRole("slider");
    const autoToggle = within(sliderRow).getByRole("button", {
      name: /start auto slide/i,
    });

    await user.click(autoToggle);
    await waitFor(() => expect(autoToggle).toHaveAttribute("aria-pressed", "true"));

    fireEvent.mouseUp(sliderInRow);

    await waitFor(() => expect(autoToggle).toHaveAttribute("aria-pressed", "true"));
  });
});

import React from "react";
import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders, reactFlowBridgeStub } from "../setup/test-env.js";
import { __TEST_ONLY__ } from "../../src/App.js";

describe("App", () => {
  it("renders without crashing (smoke)", () => {
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    expect(() => renderWithProviders(React.createElement(App))).not.toThrow();
  });

  it("keeps the dev panel hidden until toggled", async () => {
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    expect(screen.queryByText("Dev Panel (feature flags)")).toBeNull();

    const toggleButton = screen.getByRole("button", { name: /show dev panel/i });
    fireEvent.click(toggleButton);

    expect(await screen.findByText("Dev Panel (feature flags)")).toBeInTheDocument();
  });

  it("keeps the random toggle available while do() is active", () => {
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    const randomButton = screen.getAllByRole("button", { name: /random play/i })[0];
    expect(randomButton).toBeEnabled();

    const clampToggle = screen.getAllByRole("button", { name: /do\(\) clamp/i })[0];
    fireEvent.click(clampToggle);
    expect(clampToggle).toHaveAttribute("aria-pressed", "true");
    expect(randomButton).toBeEnabled();
  });
});

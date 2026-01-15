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

  it("keeps the advanced panel hidden until toggled", async () => {
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    expect(screen.queryByRole("region", { name: /advanced functions/i })).toBeNull();

    const toggleButton = screen.getByRole("button", { name: /advanced functions/i });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggleButton);

    expect(screen.getByRole("button", { name: /hide advanced functions/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("region", { name: /advanced functions/i })).toBeInTheDocument();
    expect(await screen.findByText("Assign Values")).toBeInTheDocument();
  });

  it("keeps the random toggle available while do() is active", async () => {
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    const advancedToggle = screen.getByRole("button", { name: /advanced functions/i });
    fireEvent.click(advancedToggle);

    const randomButton = (await screen.findAllByRole("button", { name: /random play/i }))[0];
    expect(randomButton).toBeEnabled();

    const clampToggle = (await screen.findAllByRole("button", { name: /do\(\) clamp/i }))[0];
    fireEvent.click(clampToggle);
    expect(clampToggle).toHaveAttribute("aria-pressed", "true");
    expect(randomButton).toBeEnabled();
  });
});

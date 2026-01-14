import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders, reactFlowBridgeStub } from "../setup/test-env.js";
import { __TEST_ONLY__ } from "../../src/App.js";

function setViewport(width, height = 900) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
}

describe("Data inspector layout", () => {
  beforeEach(() => {
    window.localStorage?.clear();
    setViewport(1200, 900);
  });

  it("toggles the data inspector open and closed", () => {
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    const toggleButton = screen.getByRole("button", { name: /hide data/i });
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: /data/i })).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByRole("button", { name: /visualize data/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByRole("region", { name: /data/i })).toBeNull();
  });

  it("renders a right dock on large viewports", () => {
    setViewport(1280, 900);
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    const dock = document.querySelector("[data-dock-mode]");
    expect(dock).toHaveAttribute("data-dock-mode", "right");
    const panel = document.querySelector(".dock-layout__secondary");
    expect(panel).not.toHaveAttribute("hidden");
  });

  it("uses bottom dock on tablet widths", () => {
    setViewport(900, 900);
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    const dock = document.querySelector("[data-dock-mode]");
    expect(dock).toHaveAttribute("data-dock-mode", "bottom");
  });

  it("shows the overlay sheet on small screens and closes via scrim", () => {
    setViewport(600, 900);
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    const dock = document.querySelector("[data-dock-mode]");
    expect(dock).toHaveAttribute("data-dock-mode", "overlay");

    expect(screen.getByRole("dialog", { name: /data/i })).toBeInTheDocument();
    const scrim = screen.getByTestId("dock-scrim");
    fireEvent.click(scrim);

    expect(screen.queryByRole("dialog", { name: /data/i })).toBeNull();
  });
});

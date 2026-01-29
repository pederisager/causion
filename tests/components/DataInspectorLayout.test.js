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

    // Mock matchMedia to use window.innerWidth so setViewport works in tests
    window.matchMedia = (query) => {
      const minMatch = query.match(/min-width:\s*(\d+)px/);
      const matches = minMatch ? window.innerWidth >= Number(minMatch[1]) : true;
      return {
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
      };
    };
  });

  it("toggles the data inspector open and closed", () => {
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    // Panel starts closed by default
    const toggleButton = screen.getByRole("button", { name: /visualize data/i });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: /data/i })).toBeNull();

    // Open the panel
    fireEvent.click(toggleButton);
    expect(screen.getByRole("button", { name: /hide data/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("region", { name: /data/i })).toBeInTheDocument();

    // Close the panel
    fireEvent.click(screen.getByRole("button", { name: /hide data/i }));
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

  it("uses bottom dock on small screens (phone layout)", () => {
    setViewport(600, 900);
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    // Small screens (width <= 900 or height <= 600) use phone layout with bottom dock
    const dock = document.querySelector("[data-dock-mode]");
    expect(dock).toHaveAttribute("data-dock-mode", "bottom");
  });
});

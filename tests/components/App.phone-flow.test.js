import React from "react";
import { describe, it, expect } from "vitest";
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

function mockMatchMedia() {
  const original = window.matchMedia;
  window.matchMedia = (query) => {
    const minMatch = query.match(/min-width:\s*(\d+)px/);
    const maxMatch = query.match(/max-width:\s*(\d+)px/);
    let matches = true;
    if (minMatch) matches = matches && window.innerWidth >= Number(minMatch[1]);
    if (maxMatch) matches = matches && window.innerWidth <= Number(maxMatch[1]);
    return {
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    };
  };
  return () => {
    window.matchMedia = original;
  };
}

describe("App phone layout & flow safety", () => {
  it("keeps the UI mounted on phones without exposing the removed Phone UI toggle", async () => {
    setViewport(600, 900);
    const restoreMatchMedia = mockMatchMedia();
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    try {
      renderWithProviders(React.createElement(App));

      expect(screen.queryByRole("button", { name: /phone ui beta/i })).toBeNull();

      const advancedToggle = await screen.findByRole("button", { name: /advanced functions/i });
      fireEvent.click(advancedToggle);

      expect(await screen.findByText("Tools")).toBeInTheDocument();
    } finally {
      restoreMatchMedia();
    }
  });

  it("disables the default delete/backspace removal in React Flow", () => {
    const recordedProps = [];
    const bridge = {
      ...reactFlowBridgeStub,
      ReactFlow: (props) => {
        recordedProps.push(props);
        return React.createElement(
          "div",
          { "data-testid": "rf" },
          props.children
        );
      },
    };

    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(bridge);

    renderWithProviders(React.createElement(App), { bridge });

    expect(recordedProps.length).toBeGreaterThan(0);
    const { deleteKeyCode } = recordedProps[recordedProps.length - 1];
    expect(deleteKeyCode).toBeNull();
  });

  it("keeps the DAG canvas mounted in bottom dock mode on phones", () => {
    setViewport(600, 900);
    const restoreMatchMedia = mockMatchMedia();
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    try {
      renderWithProviders(React.createElement(App));

      const dock = document.querySelector("[data-dock-mode]");
      expect(dock).toHaveAttribute("data-dock-mode", "bottom");
      expect(document.querySelector(".phone-dag-canvas")).toBeInTheDocument();
    } finally {
      restoreMatchMedia();
    }
  });
});

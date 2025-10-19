import React from "react";
import { describe, it, expect } from "vitest";
import { renderWithProviders, reactFlowBridgeStub } from "../setup/test-env.js";
import { __TEST_ONLY__ } from "../../src/App.js";

describe("App", () => {
  it("renders without crashing (smoke)", () => {
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    expect(() => renderWithProviders(React.createElement(App))).not.toThrow();
  });
});

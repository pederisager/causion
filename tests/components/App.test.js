import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, cleanup } from "../shims/@testing-library/react/index.js";
import { __TEST_ONLY__ } from "../../src/App.js";

test("App renders without crashing (smoke)", () => {
  const { createApp } = __TEST_ONLY__;
  const stubBridge = {
    ReactFlowProvider: ({ children }) => React.createElement("div", { className: "rf-provider" }, children),
    ReactFlow: ({ children }) => React.createElement("div", { className: "rf" }, children),
    Background: () => React.createElement("div", { className: "bg" }),
    Controls: () => React.createElement("div", { className: "controls" }),
    MiniMap: ({ children }) => React.createElement("div", { className: "minimap" }, children),
    useReactFlow: () => ({ fitView: () => {} }),
  };

  const { App } = createApp(stubBridge);
  assert.doesNotThrow(() => render(React.createElement(App)));
  cleanup();
});

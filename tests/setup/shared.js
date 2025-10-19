import React from "react";

// Lightweight stand-ins for the React Flow pieces that the app wires up.
// These keep our component tests decoupled from the real library while still
// giving the App factory something to plug into.
export const reactFlowBridgeStub = {
  ReactFlowProvider: ({ children }) =>
    React.createElement("div", { "data-testid": "rf-provider" }, children),
  ReactFlow: ({ children }) => React.createElement("div", { "data-testid": "rf" }, children),
  Background: () => React.createElement("div", { "data-testid": "rf-background" }),
  Controls: () => React.createElement("div", { "data-testid": "rf-controls" }),
  MiniMap: ({ children }) =>
    React.createElement("div", { "data-testid": "rf-minimap" }, children),
  useReactFlow: () => ({ fitView: () => {} }),
};

// Helper hooks so both Vitest and node:test suites can wrap elements without
// duplicating provider wiring.
export const defaultTestProviders = {
  wrapWithReactFlow(children, bridge = reactFlowBridgeStub) {
    const Provider = bridge.ReactFlowProvider ?? React.Fragment;
    return React.createElement(Provider, null, children);
  },
};

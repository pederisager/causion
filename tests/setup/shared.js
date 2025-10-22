import React from "react";

const positions = { Top: "top", Right: "right", Bottom: "bottom", Left: "left" };

const Handle = ({ id, children, ...rest }) =>
  React.createElement(
    "div",
    {
      "data-testid": id ? `rf-handle-${id}` : "rf-handle",
      ...rest,
      style: { ...(rest.style ?? {}), display: "none" },
    },
    children
  );

const createStateHook = () => (initial) => {
  const [items, setItems] = React.useState(initial);
  const onChange = React.useCallback(() => {}, []);
  return [items, setItems, onChange];
};

const useCollectionState = createStateHook();
const MarkerType = { ArrowClosed: "arrowclosed" };
const getStraightPath = () => ["M0,0 L1,1", { x: 0, y: 0 }];

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
  Handle,
  Position: positions,
  useNodesState: useCollectionState,
  useEdgesState: useCollectionState,
  MarkerType,
  getStraightPath,
};

// Helper hooks so both Vitest and node:test suites can wrap elements without
// duplicating provider wiring.
export const defaultTestProviders = {
  wrapWithReactFlow(children, bridge = reactFlowBridgeStub) {
    const Provider = bridge.ReactFlowProvider ?? React.Fragment;
    return React.createElement(Provider, null, children);
  },
};

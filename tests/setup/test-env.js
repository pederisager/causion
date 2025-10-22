import { afterEach, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { defaultTestProviders, reactFlowBridgeStub } from "./shared.js";

vi.mock("reactflow", () => ({
  __esModule: true,
  default: reactFlowBridgeStub.ReactFlow,
  ...reactFlowBridgeStub,
}));

if (typeof Element !== "undefined") {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
}

export { reactFlowBridgeStub } from "./shared.js";

// Reusable render helper that automatically layers in our React Flow shim so
// component suites can stay focused on assertions instead of boilerplate.
export function renderWithProviders(ui, { bridge = reactFlowBridgeStub, wrapper: CustomWrapper, ...options } = {}) {
  const Wrapper = ({ children }) => {
    if (CustomWrapper) {
      return React.createElement(CustomWrapper, { bridge }, children);
    }
    return defaultTestProviders.wrapWithReactFlow(children, bridge);
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

afterEach(() => {
  cleanup();
});

globalThis.renderWithProviders = renderWithProviders;
globalThis.reactFlowBridgeStub = reactFlowBridgeStub;

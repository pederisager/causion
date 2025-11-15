import React from "react";
import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders, reactFlowBridgeStub } from "../setup/test-env.js";
import { __TEST_ONLY__ } from "../../src/App.js";

describe("App phone layout & flow safety", () => {
  it("keeps the UI mounted when enabling Phone UI and exposes an exit control", async () => {
    const { createApp } = __TEST_ONLY__;
    const { App } = createApp(reactFlowBridgeStub);

    renderWithProviders(React.createElement(App));

    const enterButton = await screen.findByRole("button", { name: /phone ui beta/i });
    fireEvent.click(enterButton);

    expect(await screen.findByText("Tools")).toBeInTheDocument();
    const exitButton = await screen.findByRole("button", { name: /exit phone ui beta/i });
    fireEvent.click(exitButton);

    expect(await screen.findByRole("button", { name: /phone ui beta/i })).toBeInTheDocument();
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
});

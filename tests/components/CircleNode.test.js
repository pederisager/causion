import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { ReactFlowProvider } from "reactflow";
import { render, screen, getMarkup, cleanup } from "../shims/@testing-library/react/index.js";
import CircleNode from "../../src/components/nodes/CircleNode.js";

test("CircleNode renders id label and formatted value", () => {
  const data = { id: "A", value: 12.345, min: -50, max: 50 };
  render(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(CircleNode, { data })
    )
  );

  assert.doesNotThrow(() => screen.getByText("A"));
  assert.doesNotThrow(() => screen.getByText("12.35"));

  const markup = getMarkup();
  assert.ok(markup.includes("border-radius:50%"));

  cleanup();
});

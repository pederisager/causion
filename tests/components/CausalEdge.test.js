import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, getMarkup, cleanup } from "../shims/@testing-library/react/index.js";
import CausalEdge from "../../src/components/edges/CausalEdge.js";

test("CausalEdge applies marching ants style when hot", () => {
  render(
    React.createElement(CausalEdge, {
      id: "edge-1",
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      data: { hot: true, pulseMs: 900 },
    })
  );

  const markup = getMarkup();
  assert.ok(markup.includes("stroke-dasharray=\"8 8\""));
  assert.ok(markup.includes("antsForward"));

  cleanup();
});

test("CausalEdge omits marching ants when edge is idle", () => {
  render(
    React.createElement(CausalEdge, {
      id: "edge-2",
      sourceX: 0,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      data: { hot: false, pulseMs: 900 },
    })
  );

  const markup = getMarkup();
  assert.ok(!markup.includes("antsForward"));
  cleanup();
});

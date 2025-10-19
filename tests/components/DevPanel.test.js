import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, screen, getMarkup, cleanup } from "../shims/@testing-library/react/index.js";
import DevPanel from "../../src/components/panels/DevPanel.js";

test("DevPanel renders boolean and numeric feature controls", () => {
  const features = { flag: true, limit: 42 };
  const setFeatures = () => {};

  render(React.createElement(DevPanel, { features, setFeatures }));

  assert.doesNotThrow(() => screen.getByText("Dev Panel (feature flags)"));
  assert.doesNotThrow(() => screen.getByText("flag"));
  assert.doesNotThrow(() => screen.getByText("limit"));
  assert.doesNotThrow(() => screen.getByDisplayValue(42));

  const markup = getMarkup();
  assert.ok(markup.includes("type=\"checkbox\""));
  assert.ok(markup.includes("type=\"number\""));

  cleanup();
});

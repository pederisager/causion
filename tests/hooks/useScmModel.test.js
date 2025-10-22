import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useScmModel } from "../../src/hooks/useScmModel.js";

function renderHook(callback) {
  let latest;
  function Harness() {
    latest = callback();
    return null;
  }
  renderToStaticMarkup(React.createElement(Harness));
  return latest;
}

test("useScmModel parses a valid SCM and exposes dependencies", () => {
  const result = renderHook(() => useScmModel("Y = 0.5*X"));

  assert.equal(result.error, "", "no error should be reported for a valid model");
  assert.ok(result.eqs instanceof Map, "eqs should be a Map");
  assert.ok(result.eqs.get("Y").has("X"), "Y should depend on X");
  assert.ok(result.allVars.has("Y"));
  assert.ok(result.allVars.has("X"));
});

test("useScmModel surfaces parser errors", () => {
  const result = renderHook(() => useScmModel("not valid"));
  assert.ok(result.error, "an invalid model should set an error message");
  assert.equal(result.eqs.size, 0, "invalid models should yield an empty dependency map");
});

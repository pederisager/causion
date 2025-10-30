import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import { useScmModel } from "../../src/hooks/useScmModel.js";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");

if (typeof globalThis.window === "undefined") {
  globalThis.window = dom.window;
}
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
if (typeof globalThis.CustomEvent === "undefined") {
  globalThis.CustomEvent = dom.window.CustomEvent;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderHook(callback) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latest;

  function Harness() {
    latest = callback();
    return null;
  }

  act(() => {
    root.render(React.createElement(Harness));
  });

  return {
    get current() {
      return latest;
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

test("useScmModel parses the initial SCM and exposes dependencies", () => {
  const hook = renderHook(() => useScmModel("Y = 0.5*X"));

  assert.equal(hook.current.error, "", "no error should be reported for a valid model");
  assert.ok(hook.current.eqs instanceof Map, "eqs should be a Map");
  assert.ok(hook.current.eqs.get("Y").has("X"), "Y should depend on X");
  assert.ok(hook.current.allVars.has("Y"));
  assert.ok(hook.current.allVars.has("X"));

  hook.unmount();
});

test("draft edits do not update the graph until applyScmChanges runs", () => {
  const hook = renderHook(() => useScmModel("Y = 0.5*X"));

  act(() => {
    hook.current.setScmText("Z = 2");
  });

  assert.equal(hook.current.hasPendingChanges, true, "pending changes should be flagged after edits");
  assert.equal(hook.current.eqs.has("Z"), false, "graph should still reflect the previously applied model");

  let applyResult;
  act(() => {
    applyResult = hook.current.applyScmChanges();
  });

  assert.deepEqual(applyResult, { ok: true, error: "" }, "applyScmChanges should report success for valid drafts");
  assert.equal(hook.current.hasPendingChanges, false, "pending flag should clear after applying");
  assert.equal(hook.current.eqs.has("Z"), true, "graph should update after Apply Changes");
  assert.equal(hook.current.eqs.has("Y"), false, "outdated nodes should be removed after Apply Changes");

  hook.unmount();
});

test("applyScmChanges surfaces parser errors and preserves the previous graph", () => {
  const hook = renderHook(() => useScmModel("Y = 0.5*X"));

  const originalEqs = hook.current.eqs;

  act(() => {
    hook.current.setScmText("not valid");
  });

  let applyResult;
  act(() => {
    applyResult = hook.current.applyScmChanges();
  });

  assert.equal(applyResult.ok, false, "applyScmChanges should fail on invalid drafts");
  assert.ok(applyResult.error, "error message should be returned when parsing fails");
  assert.equal(hook.current.error, applyResult.error, "hook error state should match the failure message");
  assert.equal(hook.current.hasPendingChanges, true, "pending flag should remain for invalid drafts");
  assert.strictEqual(hook.current.eqs, originalEqs, "graph representation should remain unchanged after a failed apply");

  hook.unmount();
});

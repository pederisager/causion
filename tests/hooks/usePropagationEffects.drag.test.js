import React, { useLayoutEffect } from "react";
import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { usePropagationEffects } from "../../src/hooks/usePropagationEffects.js";
import { parseSCM } from "../../src/graph/parser.js";
import { depsFromModel } from "../../src/graph/topology.js";

function createHookHarness(scmText, onUpdate, featureOverrides = {}) {
  const baseFeatures = {
    causalFlow: true,
    ephemeralClamp: true,
    causalLagMs: 0,
    flowPulseMs: 0,
  };

  return function HookHarness() {
    const { model, allVars } = parseSCM(scmText);
    const eqs = depsFromModel(model);
    const hook = usePropagationEffects({
      model,
      eqs,
      allVars,
      features: { ...baseFeatures, ...featureOverrides },
    });

    useLayoutEffect(() => {
      onUpdate(hook);
    });

    return null;
  };
}

describe("usePropagationEffects – drag release", () => {
  it("syncs display values after releasing an ephemeral drag clamp", async () => {
    let latest;
    const handleUpdate = (hookState) => {
      latest = hookState;
    };

    const Harness = createHookHarness("A = 0", handleUpdate);
    const { unmount } = render(React.createElement(Harness));

    await act(async () => {
      latest.handleDragStart("A");
      latest.handleValueChange("A", 30);
    });

    expect(latest.values.A).toBe(30);
    expect(latest.displayValues.A).toBe(30);

    await act(async () => {
      latest.handleDragEnd("A");
      latest.handleValueCommit("A", 30);
    });

    await waitFor(() => {
      expect(latest.values.A).toBe(0);
      expect(latest.displayValues.A).toBe(0);
    });

    unmount();
  });
});

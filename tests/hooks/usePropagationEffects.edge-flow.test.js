import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePropagationEffects } from "../../src/hooks/usePropagationEffects.js";
import { parseSCM } from "../../src/graph/parser.js";
import { depsFromModel } from "../../src/graph/topology.js";
import { PRESET_COMPLEX } from "../../src/data/presets.js";

describe("usePropagationEffects edge pulses", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pulses both incoming edges to Col without delaying its node update", async () => {
    vi.useFakeTimers();
    const { model, allVars } = parseSCM(PRESET_COMPLEX);
    const eqs = depsFromModel(model);
    const features = {
      causalFlow: true,
      causalLagMs: 50,
      flowPulseMs: 900,
      ephemeralClamp: true,
    };
    const { result, unmount } = renderHook(() =>
      usePropagationEffects({ model, eqs, allVars, features })
    );

    await act(async () => {
      result.current.handleValueCommit("Con", 10);
    });
    expect(result.current.displayValues.Col).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.displayValues.Col).toBe(30);
    expect(result.current.edgeHot["X->Col"]).toBe(true);
    expect(result.current.edgeHot["Y->Col"]).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current.edgeHot["Y->Col"]).toBe(false);
    unmount();
  });
});

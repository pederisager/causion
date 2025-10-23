import React, { useLayoutEffect } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { usePropagationEffects } from "../../src/hooks/usePropagationEffects.js";
import { RANDOM_UPDATE_INTERVAL_MS } from "../../src/components/constants.js";

function createHookHarness(onUpdate) {
  return function HookHarness() {
    const hook = usePropagationEffects({
      model: new Map([["A", { parents: {}, constant: 0 }]]),
      eqs: new Map([["A", new Set()]]),
      allVars: new Set(["A"]),
      features: { causalFlow: false, ephemeralClamp: false },
    });

    useLayoutEffect(() => {
      onUpdate(hook);
    });

    return null;
  };
}

describe("usePropagationEffects – random mode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("emits uniform draws and stops when clamp or slide take over", async () => {
    vi.useFakeTimers();

    const randomSequence = [0.1, 0.9, 0.4, 0.3];
    let call = 0;
    const randomSpy = vi
      .spyOn(Math, "random")
      .mockImplementation(() => randomSequence[call++ % randomSequence.length]);

    const raf = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((cb) => setTimeout(() => cb(performance.now()), 16));
    const cancelRaf = vi
      .spyOn(globalThis, "cancelAnimationFrame")
      .mockImplementation((id) => clearTimeout(id));

    let latest;
    const handleUpdate = (hookState) => {
      latest = hookState;
    };

    const Harness = createHookHarness(handleUpdate);
    const { unmount } = render(React.createElement(Harness));

    expect(latest).toBeDefined();

    await act(async () => {
      latest.handleRangeMinChange("A", 0);
      latest.handleRangeMaxChange("A", 10);
    });

    await act(async () => {
      latest.toggleRandomPlay("A");
    });

    expect(latest.randomPlay.A).toBe(true);
    expect(latest.values.A).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(RANDOM_UPDATE_INTERVAL_MS);
    });
    expect(latest.values.A).toBe(9);

    await act(async () => {
      vi.advanceTimersByTime(RANDOM_UPDATE_INTERVAL_MS);
    });
    expect(latest.values.A).toBe(4);

    const callsBeforeClamp = randomSpy.mock.calls.length;
    await act(async () => {
      latest.setClamp("A", true);
    });

    expect(latest.randomPlay.A).toBe(false);
    expect(latest.interventions.A).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(randomSpy.mock.calls.length).toBe(callsBeforeClamp);
    expect(latest.values.A).toBe(4);

    await act(async () => {
      latest.setClamp("A", false);
      latest.toggleRandomPlay("A");
    });
    expect(latest.randomPlay.A).toBe(true);
    expect(latest.values.A).toBe(3);

    const callsBeforeSlide = randomSpy.mock.calls.length;
    await act(async () => {
      latest.toggleAutoPlay("A");
    });
    expect(latest.randomPlay.A).toBe(false);
    expect(latest.autoPlay.A).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(randomSpy.mock.calls.length).toBe(callsBeforeSlide);

    await act(async () => {
      latest.toggleAutoPlay("A");
    });

    expect(raf).toHaveBeenCalled();
    expect(cancelRaf).toHaveBeenCalled();

    unmount();
  });
});

import React, { useLayoutEffect } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { usePropagationEffects } from "../../src/hooks/usePropagationEffects.js";
import { RANDOM_UPDATE_INTERVAL_MS } from "../../src/components/constants.js";

function createHookHarness(onUpdate, featureOverrides = {}) {
  const baseFeatures = {
    causalFlow: false,
    ephemeralClamp: false,
    causalLagMs: 0,
    flowPulseMs: 0,
  };

  return function HookHarness() {
    const hook = usePropagationEffects({
      model: new Map([["A", { parents: {}, constant: 0 }]]),
      eqs: new Map([["A", new Set()]]),
      allVars: new Set(["A"]),
      features: { ...baseFeatures, ...featureOverrides },
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

  it("syncs display values with model output when randomness stops", async () => {
    vi.useFakeTimers();

    const randomSequence = [0.2, 0.8, 0.6];
    let call = 0;
    vi.spyOn(Math, "random").mockImplementation(
      () => randomSequence[call++ % randomSequence.length]
    );

    let latest;
    const handleUpdate = (hookState) => {
      latest = hookState;
    };

    const Harness = createHookHarness(handleUpdate, {
      causalFlow: true,
      ephemeralClamp: false,
      causalLagMs: 50,
      flowPulseMs: 120,
    });

    const { unmount } = render(React.createElement(Harness));

    expect(latest).toBeDefined();

    await act(async () => {
      latest.handleRangeMinChange("A", 0);
      latest.handleRangeMaxChange("A", 10);
      latest.toggleRandomPlay("A");
    });

    expect(latest.randomPlay.A).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(RANDOM_UPDATE_INTERVAL_MS);
    });

    expect(latest.values.A).toBeGreaterThan(0);
    expect(latest.displayValues.A).toBe(latest.values.A);

    await act(async () => {
      latest.toggleRandomPlay("A");
    });

    await act(async () => {
      vi.advanceTimersByTime(RANDOM_UPDATE_INTERVAL_MS + 500);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(latest.randomPlay.A).toBe(false);
    expect(latest.values.A).toBe(0);
    expect(latest.displayValues.A).toBe(0);

    unmount();
  });

  it("keeps clamp active and preserves last random value when do() is enabled", async () => {
    vi.useFakeTimers();

    const randomSequence = [0.15, 0.85];
    let call = 0;
    vi.spyOn(Math, "random").mockImplementation(
      () => randomSequence[call++ % randomSequence.length]
    );

    let latest;
    const handleUpdate = (hookState) => {
      latest = hookState;
    };

    const Harness = createHookHarness(handleUpdate, {
      causalFlow: true,
      ephemeralClamp: true,
      causalLagMs: 50,
      flowPulseMs: 120,
    });

    const { unmount } = render(React.createElement(Harness));

    await act(async () => {
      latest.handleRangeMinChange("A", 0);
      latest.handleRangeMaxChange("A", 10);
      latest.setClamp("A", true);
    });

    expect(latest.interventions.A).toBe(true);

    await act(async () => {
      latest.toggleRandomPlay("A");
    });

    expect(latest.randomPlay.A).toBe(true);
    expect(latest.interventions.A).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(RANDOM_UPDATE_INTERVAL_MS + 10);
    });

    const valueWhileRandom = latest.values.A;
    expect(valueWhileRandom).toBeGreaterThan(0);

    await act(async () => {
      latest.toggleRandomPlay("A");
    });

    await act(async () => {
      vi.advanceTimersByTime(RANDOM_UPDATE_INTERVAL_MS + 200);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(latest.randomPlay.A).toBe(false);
    expect(latest.interventions.A).toBe(true);
    expect(latest.values.A).toBe(valueWhileRandom);
    expect(latest.displayValues.A).toBe(valueWhileRandom);

    unmount();
  });
});

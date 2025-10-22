import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseSCM } from "../../src/graph/parser.js";
import { depsFromModel } from "../../src/graph/topology.js";
import { computeValues } from "../../src/graph/math.js";
import { scheduleNodeDisplayUpdate } from "../../src/utils/timers.js";
import { __TEST_ONLY__ as propagationHelpers } from "../../src/hooks/usePropagationEffects.js";

const { computePropagationPlan } = propagationHelpers;

const REPRO_SCM = `
A = 5
M = 0.6*A - 0.2 + error
Y = -1 + 0.5*M + 0.3*A
`;

const MULTI_BRANCH_SCM = `
U = 2
X = 1 + 0.5*U
Z = -0.25*X + 4
Y = 0.6*X + 0.2*Z - 3
W = 0.1*Y + 0.2*Z + 1
`;

function runScm(text, overrides = {}) {
  const { model, allVars } = parseSCM(text);
  const eqs = depsFromModel(model);
  const current = {};
  for (const id of allVars) {
    current[id] = overrides[id] ?? 0;
  }
  const clamp = overrides.clamp ?? {};
  const next = computeValues(model, eqs, current, clamp);
  return { model, eqs, next };
}

function invertDependencies(eqs) {
  const map = new Map();
  for (const [child, parents] of eqs) {
    for (const parent of parents) {
      if (!map.has(parent)) map.set(parent, new Set());
      map.get(parent).add(child);
    }
  }
  return map;
}

describe("SCM propagation math", () => {
  it("propagates the reported reproduction model with deterministic values", () => {
    const { next } = runScm(REPRO_SCM);

    expect(next.A).toBeCloseTo(5);
    expect(next.M).toBeCloseTo(2.8);
    expect(next.Y).toBeCloseTo(1.9);
  });

  it("propagates a multi-branch SCM and matches the end-to-end expectation", () => {
    const { next } = runScm(MULTI_BRANCH_SCM);

    expect(next.U).toBeCloseTo(2);
    expect(next.X).toBeCloseTo(2);
    expect(next.Z).toBeCloseTo(3.5);
    expect(next.Y).toBeCloseTo(-1.1);
    expect(next.W).toBeCloseTo(1.59);
  });
});

describe("Seeded lag propagation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("schedules descendants in breadth-first depth order", () => {
    const { eqs, next } = runScm(MULTI_BRANCH_SCM);
    const parentToChildren = invertDependencies(eqs);
    const seeds = ["X"];
    const lag = 75;

    const plan = computePropagationPlan(seeds, parentToChildren, lag);
    expect(plan).toEqual([
      { node: "Z", parent: "X", delay: 75 },
      { node: "Y", parent: "X", delay: 75 },
      { node: "W", parent: "Z", delay: 150 },
    ]);

    const nodeTimers = new Map();
    const pending = [];
    const display = { X: next.X, Z: 0, Y: 0, W: 0 };

    for (const step of plan) {
      scheduleNodeDisplayUpdate(nodeTimers, pending, step.node, step.delay, () => {
        display[step.node] = next[step.node];
      });
    }

    expect(display).toMatchObject({ X: 2, Z: 0, Y: 0, W: 0 });

    vi.advanceTimersByTime(75);
    expect(display.Z).toBeCloseTo(3.5);
    expect(display.Y).toBeCloseTo(-1.1);
    expect(display.W).toBe(0);

    vi.advanceTimersByTime(75);
    expect(display.W).toBeCloseTo(1.59);
  });

  it("commits immediate descendants when lag is zero", () => {
    const { eqs, next } = runScm(MULTI_BRANCH_SCM);
    const parentToChildren = invertDependencies(eqs);
    const seeds = ["X"];
    const plan = computePropagationPlan(seeds, parentToChildren, 0);

    expect(plan).toEqual([
      { node: "Z", parent: "X", delay: 0 },
      { node: "Y", parent: "X", delay: 0 },
      { node: "W", parent: "Z", delay: 0 },
    ]);

    const nodeTimers = new Map();
    const pending = [];
    const display = { X: next.X, Z: 0, Y: 0, W: 0 };

    for (const step of plan) {
      scheduleNodeDisplayUpdate(nodeTimers, pending, step.node, step.delay, () => {
        display[step.node] = next[step.node];
      });
    }

    vi.runAllTimers();

    expect(display.Z).toBeCloseTo(3.5);
    expect(display.Y).toBeCloseTo(-1.1);
    expect(display.W).toBeCloseTo(1.59);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleNodeDisplayUpdate } from "../../src/utils/timers.js";
import { __TEST_ONLY__ as helpers } from "../../src/hooks/usePropagationEffects.js";

const { clampToRange, tri, computePropagationPlan } = helpers;

test("clampToRange keeps values inside the provided bounds", () => {
  assert.equal(clampToRange(5, { min: 0, max: 10 }), 5);
  assert.equal(clampToRange(-5, { min: 0, max: 10 }), 0);
  assert.equal(clampToRange(15, { min: 0, max: 10 }), 10);
});

test("tri produces a triangle wave between 0 and 1", () => {
  assert.equal(tri(0), 0);
  assert.equal(tri(0.25), 0.5);
  assert.equal(tri(0.5), 1);
  assert.equal(tri(0.75), 0.5);
  assert.equal(tri(1.25), 0.5);
});

test("computePropagationPlan schedules descendants by depth", () => {
  const parentToChildren = new Map([
    ["A", new Set(["B", "C"])],
    ["B", new Set(["D"])],
    ["C", new Set(["D"])],
  ]);

  const plan = computePropagationPlan(["A"], parentToChildren, 40);
  assert.deepEqual(plan, [
    { node: "B", parent: "A", delay: 40 },
    { node: "C", parent: "A", delay: 40 },
    { node: "D", parent: "B", delay: 80 },
  ]);
});

test("computePropagationPlan integrates with timer scheduling", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const parentToChildren = new Map([["A", new Set(["B"])], ["B", new Set(["C"])]]);
  const plan = computePropagationPlan(["A"], parentToChildren, 50);

  const nodeTimers = new Map();
  const pending = [];
  const fired = [];

  for (const step of plan) {
    scheduleNodeDisplayUpdate(
      nodeTimers,
      pending,
      step.node,
      step.delay,
      () => fired.push(step.node)
    );
  }

  assert.equal(nodeTimers.size, 2, "two nodes should have timers queued");

  t.mock.timers.tick(50);
  assert.deepEqual(fired, ["B"], "first depth should fire after one lag interval");

  t.mock.timers.tick(50);
  assert.deepEqual(fired, ["B", "C"], "deeper descendants fire after additional lag");

  t.mock.timers.reset();
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scheduleNodeDisplayUpdate,
  scheduleEdgePulse,
  clearPendingTimers,
} from "../../src/utils/timers.js";
import { __TEST_ONLY__ as helpers } from "../../src/hooks/usePropagationEffects.js";

const { computePropagationPlan, collectPropagationSeeds, createNodeDisplayUpdater } = helpers;

function makeGraph(entries) {
  const map = new Map();
  for (const [parent, children] of entries) {
    map.set(parent, new Set(children));
  }
  return map;
}

test("deterministic lag scheduling uses consistent delays", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const parentToChildren = makeGraph([
    ["A", ["B", "C"]],
    ["B", ["D"]],
    ["C", ["E"]],
  ]);

  const seeds = ["A"];
  const plan = computePropagationPlan(seeds, parentToChildren, 25);
  assert.deepEqual(plan, [
    { node: "B", parent: "A", delay: 25 },
    { node: "C", parent: "A", delay: 25 },
    { node: "D", parent: "B", delay: 50 },
    { node: "E", parent: "C", delay: 50 },
  ]);

  const nodeTimers = new Map();
  const pending = [];
  const fired = [];

  for (const step of plan) {
    scheduleNodeDisplayUpdate(
      nodeTimers,
      pending,
      step.node,
      step.delay,
      () => fired.push(step.delay)
    );
  }

  assert.equal(nodeTimers.size, 4);
  assert.equal(pending.length, 4);

  t.mock.timers.tick(25);
  assert.deepEqual(fired, [25, 25]);

  t.mock.timers.tick(25);
  assert.deepEqual(fired, [25, 25, 50, 50]);

  t.mock.timers.reset();
});

test("pending node timers are reused and emit the freshest value", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const nodeTimers = new Map();
  const pending = [];
  const lastValuesRef = { current: { B: 1 } };
  let display = { B: 0 };

  const setDisplayValues = (updater) => {
    display = typeof updater === "function" ? updater(display) : updater;
    return display;
  };

  const firstTimer = scheduleNodeDisplayUpdate(
    nodeTimers,
    pending,
    "B",
    60,
    createNodeDisplayUpdater(lastValuesRef, "B", setDisplayValues)
  );

  lastValuesRef.current = { B: 5 };
  const secondTimer = scheduleNodeDisplayUpdate(
    nodeTimers,
    pending,
    "B",
    60,
    createNodeDisplayUpdater(lastValuesRef, "B", setDisplayValues)
  );

  assert.equal(secondTimer, firstTimer, "subsequent schedules reuse the pending timer");
  assert.equal(pending.length, 1, "only one timer is tracked while pending");

  lastValuesRef.current = { B: 42 };
  scheduleNodeDisplayUpdate(
    nodeTimers,
    pending,
    "B",
    60,
    createNodeDisplayUpdater(lastValuesRef, "B", setDisplayValues)
  );

  t.mock.timers.tick(60);
  assert.equal(display.B, 42, "the display reflects the freshest value when the timer fires");
  assert.equal(pending.length, 0, "fired timers are removed from the pending list");

  t.mock.timers.reset();
});

test("seeded nodes commit immediately before timers fire", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const parentToChildren = makeGraph([["A", ["B"]]]);
  const values = { A: 3, B: 9 };
  const display = { A: 0, B: 0 };

  const seeds = collectPropagationSeeds({
    changedIds: ["A"],
    directChanged: { A: true },
    interventions: {},
    autoPlay: {},
    dragging: { A: false },
    features: { ephemeralClamp: false },
  });

  seeds.forEach((id) => {
    display[id] = values[id];
  });

  const plan = computePropagationPlan(seeds, parentToChildren, 40);
  const nodeTimers = new Map();
  const pending = [];

  for (const step of plan) {
    scheduleNodeDisplayUpdate(
      nodeTimers,
      pending,
      step.node,
      step.delay,
      () => {
        display[step.node] = values[step.node];
      }
    );
  }

  assert.equal(display.A, 3);
  assert.equal(display.B, 0);

  t.mock.timers.tick(40);
  assert.equal(display.B, 9);

  t.mock.timers.reset();
});

test("node display updater reads the latest value when the timer fires", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const nodeTimers = new Map();
  const pending = [];
  const lastValuesRef = { current: { B: 1 } };
  let display = { B: 0 };

  const setDisplayValues = (updater) => {
    display = typeof updater === "function" ? updater(display) : updater;
    return display;
  };

  scheduleNodeDisplayUpdate(
    nodeTimers,
    pending,
    "B",
    60,
    createNodeDisplayUpdater(lastValuesRef, "B", setDisplayValues)
  );

  lastValuesRef.current = { B: 42 };

  t.mock.timers.tick(60);

  assert.equal(display.B, 42);

  t.mock.timers.reset();
});

test("propagation plan avoids cycles and keeps earliest path", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const parentToChildren = makeGraph([
    ["A", ["B"]],
    ["B", ["A", "C"]],
    ["X", ["C"]],
  ]);

  const plan = computePropagationPlan(["A", "X"], parentToChildren, 10);

  assert.deepEqual(plan, [
    { node: "B", parent: "A", delay: 10 },
    { node: "C", parent: "X", delay: 10 },
  ]);

  const nodeTimers = new Map();
  const pending = [];
  const fired = [];

  for (const step of plan) {
    scheduleNodeDisplayUpdate(
      nodeTimers,
      pending,
      step.node,
      step.delay,
      () => fired.push(step.parent)
    );
  }

  t.mock.timers.tick(10);
  assert.deepEqual(fired, ["A", "X"]);

  t.mock.timers.tick(10);
  assert.deepEqual(fired, ["A", "X"]);

  t.mock.timers.reset();
});

test("clearPendingTimers cancels node and edge schedules", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const nodeTimers = new Map();
  const edgeTimers = new Map();
  const pending = [];
  let edgeState = {};

  scheduleNodeDisplayUpdate(
    nodeTimers,
    pending,
    "B",
    100,
    () => {
      throw new Error("node timer should be cleared");
    }
  );

  scheduleEdgePulse(
    edgeTimers,
    pending,
    "A->B",
    40,
    50,
    (updater) => {
      edgeState = typeof updater === "function" ? updater(edgeState) : updater;
      return edgeState;
    }
  );

  clearPendingTimers(pending, nodeTimers, edgeTimers);

  assert.equal(pending.length, 0);
  assert.equal(nodeTimers.size, 0);
  assert.equal(edgeTimers.size, 0);

  t.mock.timers.tick(200);
  assert.deepEqual(edgeState, {});

  t.mock.timers.reset();
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { scheduleNodeDisplayUpdate, scheduleEdgePulse } from '../src/utils/lagScheduler.js';

test('scheduleNodeDisplayUpdate replaces pending timer with latest callback', async (t) => {
  const nodeTimers = new Map();
  const pending = [];
  t.after(() => pending.forEach((timer) => clearTimeout(timer)));

  let callCount = 0;

  scheduleNodeDisplayUpdate(nodeTimers, pending, 'X', 25, () => {
    callCount += 1;
  });

  scheduleNodeDisplayUpdate(nodeTimers, pending, 'X', 10, () => {
    callCount += 1;
  });

  assert.equal(nodeTimers.size, 1, 'only one timer should remain in the map');

  await delay(35);

  assert.equal(callCount, 1, 'only the latest callback should run');
  assert.equal(nodeTimers.size, 0, 'timer map cleans up after running');
});

test('scheduleEdgePulse cancels previous pulses and toggles edge state once', async (t) => {
  const edgeTimers = new Map();
  const pending = [];
  t.after(() => pending.forEach((timer) => clearTimeout(timer)));

  let edgeState = {};
  const setEdgeHot = (updater) => {
    edgeState = updater(edgeState);
  };

  scheduleEdgePulse(edgeTimers, pending, 'A->B', 40, 40, setEdgeHot);

  // Rapid re-trigger before the first delay elapses
  await delay(5);
  scheduleEdgePulse(edgeTimers, pending, 'A->B', 10, 40, setEdgeHot);

  assert.equal(edgeTimers.size, 1, 'only the most recent timers are kept');

  await delay(20);
  assert.equal(edgeState['A->B'], true, 'edge should be marked hot after the delay');

  await delay(60);
  assert.ok(!edgeTimers.has('A->B'), 'edge timer entry should clean up after cooling down');
  assert.equal(edgeState['A->B'], false, 'edge should be reset to not hot');
});

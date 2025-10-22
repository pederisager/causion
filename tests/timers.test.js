import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { scheduleNodeDisplayUpdate, scheduleEdgePulse } from '../src/utils/timers.js';

test('scheduleNodeDisplayUpdate keeps multiple timers so every update runs', async (t) => {
  const nodeTimers = new Map();
  const pending = [];
  t.after(() => pending.forEach((timer) => clearTimeout(timer)));

  const calledAt = [];

  scheduleNodeDisplayUpdate(nodeTimers, pending, 'X', 25, () => {
    calledAt.push('first');
  });

  scheduleNodeDisplayUpdate(nodeTimers, pending, 'X', 10, () => {
    calledAt.push('second');
  });

  // Two timers should be tracked for node X until they both fire.
  assert.equal(nodeTimers.size, 1, 'node entry should remain a single map key');
  assert.equal(nodeTimers.get('X').size, 2, 'both timers should be stored for the node');

  await delay(50);

  assert.deepEqual(calledAt, ['second', 'first']);
  assert.equal(nodeTimers.size, 0, 'timer map cleans up after all timers finish');
});

test('scheduleEdgePulse stacks pulses and only cools once all are done', async (t) => {
  const edgeTimers = new Map();
  const pending = [];
  t.after(() => pending.forEach((timer) => clearTimeout(timer)));

  let edgeState = {};
  const history = [];
  const setEdgeHot = (updater) => {
    edgeState = updater(edgeState);
    history.push(edgeState['A->B'] ?? false);
  };

  scheduleEdgePulse(edgeTimers, pending, 'A->B', 30, 120, setEdgeHot);

  // Rapid re-trigger before the first pulse even starts.
  await delay(5);
  scheduleEdgePulse(edgeTimers, pending, 'A->B', 10, 40, setEdgeHot);

  assert.equal(edgeTimers.size, 1, 'edge entry should be reused');

  await delay(20);
  assert.equal(edgeState['A->B'], true, 'edge becomes hot once the first pulse starts');

  await delay(80);
  assert.equal(edgeState['A->B'], true, 'edge stays hot while any pulse is active');

  await delay(80);
  assert.ok(!edgeTimers.has('A->B'), 'edge timers clean up after all pulses end');
  assert.equal(edgeState['A->B'], false, 'edge cools once the final pulse finishes');
  assert.ok(history.includes(true), 'history recorded the hot state toggles');
});

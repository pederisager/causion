import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdgeVisualState } from '../src/utils/edgeUtils.js';

const features = { causalFlow: true, flowPulseMs: 500, edgeStraightening: true };

test('applyEdgeVisualState keeps original edges when nothing changes', () => {
  const edges = [
    { id: 'A->B', type: 'causal', data: { hot: true, pulseMs: 500 } },
    { id: 'B->C', type: 'causal', data: { hot: false, pulseMs: 500 } },
  ];
  const hotMap = { 'A->B': true, 'B->C': false };

  const result = applyEdgeVisualState(edges, hotMap, features);

  assert.strictEqual(result, edges);
});

test('applyEdgeVisualState updates only edges whose hot flag changes', () => {
  const edges = [
    { id: 'A->B', type: 'causal', data: { hot: false, pulseMs: 500 } },
    { id: 'B->C', type: 'causal', data: { hot: false, pulseMs: 500 } },
  ];
  const hotMap = { 'A->B': true, 'B->C': false };

  const result = applyEdgeVisualState(edges, hotMap, features);

  assert.notStrictEqual(result, edges);
  assert.notStrictEqual(result[0], edges[0]);
  assert.strictEqual(result[1], edges[1]);
  assert.equal(result[0].data.hot, true);
  assert.equal(result[1].data.hot, false);
});

test('applyEdgeVisualState clears hot state when causal flow disabled', () => {
  const edges = [
    { id: 'A->B', type: 'causal', data: { hot: true, pulseMs: 500 } },
  ];
  const result = applyEdgeVisualState(edges, { 'A->B': true }, {
    causalFlow: false,
    flowPulseMs: 700,
    edgeStraightening: true,
  });

  assert.notStrictEqual(result, edges);
  assert.equal(result[0].type, 'straight');
  assert.equal(result[0].data.hot, false);
  assert.equal(result[0].data.pulseMs, 700);
});

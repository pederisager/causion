import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyNodeData } from '../src/utils/nodeUtils.js';

test('applyNodeData returns original array when nothing changes', () => {
  const nodes = [
    { id: 'A', data: { id: 'A', value: 2, min: -10, max: 10 } },
    { id: 'B', data: { id: 'B', value: 1, min: -5, max: 5 } },
  ];
  const display = { A: 2, B: 1 };
  const ranges = { A: { min: -10, max: 10 }, B: { min: -5, max: 5 } };

  const result = applyNodeData(nodes, display, ranges);

  assert.strictEqual(result, nodes);
});

test('applyNodeData only replaces nodes whose values changed', () => {
  const nodes = [
    { id: 'A', data: { id: 'A', value: 2, min: -10, max: 10 } },
    { id: 'B', data: { id: 'B', value: 1, min: -5, max: 5 } },
  ];
  const display = { A: 2, B: 3 };
  const ranges = { A: { min: -10, max: 10 }, B: { min: -5, max: 5 } };

  const result = applyNodeData(nodes, display, ranges);

  assert.notStrictEqual(result, nodes);
  assert.strictEqual(result[0], nodes[0]);
  assert.notStrictEqual(result[1], nodes[1]);
  assert.equal(result[1].data.value, 3);
});

test('applyNodeData updates min and max when range changes', () => {
  const nodes = [
    { id: 'A', data: { id: 'A', value: 0, min: -10, max: 10 } },
  ];
  const display = { A: 0 };
  const ranges = { A: { min: -4, max: 8 } };

  const result = applyNodeData(nodes, display, ranges);

  assert.notStrictEqual(result, nodes);
  assert.equal(result[0].data.min, -4);
  assert.equal(result[0].data.max, 8);
});

test('applyNodeData marks controlled nodes when provided', () => {
  const nodes = [
    { id: 'A', data: { id: 'A', value: 0, min: -10, max: 10 } },
    { id: 'B', data: { id: 'B', value: 1, min: -10, max: 10 } },
  ];
  const display = { A: 0, B: 1 };
  const ranges = { A: { min: -10, max: 10 }, B: { min: -10, max: 10 } };

  const result = applyNodeData(nodes, display, ranges, 'causion', null, ['B']);

  assert.equal(result[0].data.isControlled, false);
  assert.equal(result[1].data.isControlled, true);
});

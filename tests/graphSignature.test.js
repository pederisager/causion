import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraphSignature } from '../src/utils/graphSignature.js';

test('buildGraphSignature normalises parent ordering', () => {
  const eqs = new Map([
    ['B', new Set(['A', 'C'])],
    ['A', new Set()],
  ]);

  const shuffled = new Map([
    ['A', new Set()],
    ['B', new Set(['C', 'A'])],
  ]);

  const sig1 = buildGraphSignature(eqs);
  const sig2 = buildGraphSignature(shuffled);

  assert.equal(sig1, sig2);
});

test('buildGraphSignature handles falsy or empty inputs', () => {
  assert.equal(buildGraphSignature(null), '[]');
  assert.equal(buildGraphSignature(undefined), '[]');
  assert.equal(buildGraphSignature([]), '[]');
});

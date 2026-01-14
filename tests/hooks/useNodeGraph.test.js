import { test } from "node:test";
import assert from "node:assert/strict";
import { NODE_HEIGHT, NODE_SEPARATION, NODE_WIDTH, RANK_SEPARATION } from "../../src/components/constants.js";
import { __TEST_ONLY__ } from "../../src/hooks/useNodeGraph.js";

const { layoutLeftRight, resolveNodePosition } = __TEST_ONLY__;

function makeDeps(entries) {
  return new Map(entries.map(([child, parents]) => [child, new Set(parents)]));
}

test("layoutLeftRight positions parent ranks before children", () => {
  const eqs = makeDeps([
    ["A", []],
    ["B", ["A"]],
    ["C", ["B"]],
  ]);

  const pos = layoutLeftRight(eqs);
  assert.equal(pos.B.x, pos.A.x + NODE_WIDTH + RANK_SEPARATION);
  assert.equal(pos.C.x, pos.B.x + NODE_WIDTH + RANK_SEPARATION);
  assert.ok(pos.B.y >= 50);
});

test("layoutLeftRight staggers siblings evenly", () => {
  const eqs = makeDeps([
    ["A", []],
    ["B", ["A"]],
    ["C", ["A"]],
    ["D", ["A"]],
  ]);

  const pos = layoutLeftRight(eqs);
  const baseX = pos.B.x;
  assert.equal(pos.C.x, baseX);
  assert.equal(pos.D.x, baseX);

  const gapBC = Math.abs(pos.B.y - pos.C.y);
  const gapCD = Math.abs(pos.C.y - pos.D.y);
  const expectedGap = NODE_HEIGHT + NODE_SEPARATION;
  assert.ok(gapBC >= expectedGap);
  assert.ok(gapCD >= expectedGap);
});

test("resolveNodePosition preserves manual positions when layout is locked", () => {
  const prevNode = { position: { x: 10, y: 20 } };
  const pos = resolveNodePosition({
    id: "A",
    index: 0,
    prevNode,
    positions: { A: { x: 200, y: 200 } },
    positionOverrides: { A: { x: 300, y: 300 } },
    preserveLayout: true,
  });
  assert.deepEqual(pos, { x: 10, y: 20 });
});

test("resolveNodePosition uses overrides for new nodes when layout is locked", () => {
  const pos = resolveNodePosition({
    id: "B",
    index: 1,
    prevNode: undefined,
    positions: { B: { x: 200, y: 200 } },
    positionOverrides: { B: { x: 80, y: 90 } },
    preserveLayout: true,
  });
  assert.deepEqual(pos, { x: 80, y: 90 });
});

test("resolveNodePosition uses layout positions when not preserving", () => {
  const pos = resolveNodePosition({
    id: "C",
    index: 0,
    prevNode: { position: { x: 10, y: 20 } },
    positions: { C: { x: 140, y: 160 } },
    positionOverrides: { C: { x: 300, y: 300 } },
    preserveLayout: false,
  });
  assert.deepEqual(pos, { x: 140, y: 160 });
});

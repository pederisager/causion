import { test } from "node:test";
import assert from "node:assert/strict";
import { NODE_HEIGHT, NODE_SEPARATION, NODE_WIDTH, RANK_SEPARATION } from "../../src/components/constants.js";
import { __TEST_ONLY__ } from "../../src/hooks/useNodeGraph.js";

const { layoutLeftRight } = __TEST_ONLY__;

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

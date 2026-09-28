import { test } from "node:test";
import assert from "node:assert/strict";
import { NODE_HEIGHT, NODE_SEPARATION, NODE_WIDTH, RANK_SEPARATION } from "../../src/components/constants.js";
import { PRESET_COMPLEX } from "../../src/data/presets.js";
import { parseSCM } from "../../src/graph/parser.js";
import { depsFromModel } from "../../src/graph/topology.js";
import { __TEST_ONLY__ } from "../../src/hooks/useNodeGraph.js";

const { layoutLeftRight, resolveNodePosition } = __TEST_ONLY__;

function makeDeps(entries) {
  return new Map(entries.map(([child, parents]) => [child, new Set(parents)]));
}

function layoutScm(text) {
  const { model, allVars } = parseSCM(text);
  const eqs = depsFromModel(model);
  return {
    entries: [...eqs].map(([child, parents]) => [child, [...parents]]),
    positions: layoutLeftRight(eqs, allVars),
  };
}

function assertReadableLayout(entries, positions, maxRows) {
  const ids = Object.keys(positions);
  const rows = new Set(ids.map((id) => positions[id].y));
  assert.ok(rows.size <= maxRows, `used ${rows.size} rows, expected at most ${maxRows}`);

  for (const [child, parents] of entries) {
    for (const parent of parents) {
      assert.ok(positions[parent].x < positions[child].x, `${parent} must precede ${child}`);
      const start = {
        x: positions[parent].x + NODE_WIDTH / 2,
        y: positions[parent].y + NODE_HEIGHT / 2,
      };
      const end = {
        x: positions[child].x + NODE_WIDTH / 2,
        y: positions[child].y + NODE_HEIGHT / 2,
      };
      for (const id of ids) {
        if (id === parent || id === child) continue;
        const node = {
          x: positions[id].x + NODE_WIDTH / 2,
          y: positions[id].y + NODE_HEIGHT / 2,
        };
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const fraction = Math.max(0, Math.min(1,
          ((node.x - start.x) * dx + (node.y - start.y) * dy) / (dx * dx + dy * dy)
        ));
        const distance = Math.hypot(
          node.x - (start.x + fraction * dx),
          node.y - (start.y + fraction * dy)
        );
        assert.ok(
          distance >= NODE_WIDTH / 2 + 8,
          `${parent} → ${child} passes too close to ${id}: ${distance.toFixed(1)}px`
        );
      }
    }
  }

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = positions[ids[i]];
      const b = positions[ids[j]];
      assert.ok(
        Math.abs(a.x - b.x) >= NODE_WIDTH || Math.abs(a.y - b.y) >= NODE_HEIGHT,
        `${ids[i]} overlaps ${ids[j]}`
      );
    }
  }
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

test("layoutLeftRight opens a three-node confounding triangle", () => {
  const entries = [
    ["Y", ["X", "C"]],
    ["X", ["C"]],
  ];
  const positions = layoutLeftRight(makeDeps(entries));
  const reordered = layoutLeftRight(makeDeps([...entries].reverse()));

  assert.deepEqual(positions, reordered);
  assert.ok(positions.C.x < positions.X.x && positions.X.x < positions.Y.x);
  assert.equal(positions.C.y, positions.Y.y);
  assert.equal(positions.X.y - positions.C.y, NODE_HEIGHT + NODE_SEPARATION);
});

test("layoutLeftRight keeps a plain three-node chain on its normal path", () => {
  const positions = layoutLeftRight(makeDeps([
    ["X", ["C"]],
    ["Y", ["X"]],
  ]));

  assert.deepEqual(positions, {
    C: { x: 50, y: 50 },
    X: { x: 50 + NODE_WIDTH + RANK_SEPARATION, y: 50 },
    Y: { x: 50 + 2 * (NODE_WIDTH + RANK_SEPARATION), y: 50 },
  });
});

test("layoutLeftRight aligns the complex preset without edges cutting through nodes", () => {
  const { entries, positions } = layoutScm(PRESET_COMPLEX);
  assertReadableLayout(entries, positions, 3);
  assert.equal(positions.Con.y, positions.Y.y);
  assert.equal(positions.X.y, positions.Col.y);
  assert.ok(positions.Col.x + NODE_WIDTH - positions.Con.x <= 1050);
  assert.deepEqual(positions, layoutLeftRight(makeDeps([...entries].reverse())));
});

test("layoutLeftRight keeps a deep shortcut DAG compact and unobstructed", () => {
  const { entries, positions } = layoutScm("B=A\nC=B\nD=C+A\nQ=D+B\nR=Q+C");
  assertReadableLayout(entries, positions, 3);
  assert.ok(positions.R.x + NODE_WIDTH - positions.A.x <= 1200);
  assert.deepEqual(positions, layoutLeftRight(makeDeps([...entries].reverse())));
});

test("layoutLeftRight keeps a branching mesh and its shortcut clear", () => {
  const { entries, positions } = layoutScm(
    "B=A\nC=A\nD=B+C\nQ=B+C\nF=D+Q\nG=D+Q\nH=F+G+A"
  );
  assertReadableLayout(entries, positions, 5);
  assert.deepEqual(positions, layoutLeftRight(makeDeps([...entries].reverse())));
});

test("layoutLeftRight arranges multiple roots and a converging sink", () => {
  const { entries, positions } = layoutScm(
    "U=Ra+Rb\nV=Rb+Rc\nW=U+V\nZ=W+Ra+Rc"
  );
  assertReadableLayout(entries, positions, 5);
  assert.deepEqual(positions, layoutLeftRight(makeDeps([...entries].reverse())));
});

test("layoutLeftRight handles a larger branching DAG with long shortcuts", () => {
  const { entries, positions } = layoutScm(
    "A=R\nB=R\nC=A\nD=B\nF=C+D\nG=A+D\nH=F+G\nJ=H+R\nK=J+C\nL=K+D"
  );
  assertReadableLayout(entries, positions, 6);
  assert.deepEqual(positions, layoutLeftRight(makeDeps([...entries].reverse())));
});

test("layoutLeftRight supports a wide rank without dropping nodes", () => {
  const entries = Array.from({ length: 12 }, (_, index) => [`N${index}`, ["Root"]]);
  const positions = layoutLeftRight(makeDeps(entries));
  assert.equal(Object.keys(positions).length, 13);
  assert.equal(new Set(entries.map(([id]) => positions[id].y)).size, 12);
  assert.deepEqual(positions, layoutLeftRight(makeDeps([...entries].reverse())));
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

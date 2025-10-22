import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSCM } from "../../src/graph/parser.js";
import { PRESETS, tri } from "../../src/data/presets.js";

test("all presets parse without throwing", () => {
  for (const preset of PRESETS) {
    assert.doesNotThrow(() => {
      const { model, allVars } = parseSCM(preset.text);
      assert.ok(model instanceof Map, "model should be a Map");
      assert.ok(allVars.size > 0, "preset should declare at least one variable");
    }, `preset ${preset.key} should parse`);
  }
});

test("tri helper returns a symmetric waveform", () => {
  const samples = [0, 0.25, 0.5, 0.75, 1.5];
  const outputs = samples.map((phase) => tri(phase));
  assert.deepEqual(outputs, [0, 0.5, 1, 0.5, 1]);
});

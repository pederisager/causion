export const NODE_WIDTH = 120;
export const NODE_HEIGHT = 120;
export const RANK_SEPARATION = 160;
export const NODE_SEPARATION = 40;
export const NOISE_NODE_SCALE = 0.55;
export const NOISE_NODE_SIZE = Math.round(NODE_WIDTH * NOISE_NODE_SCALE);
export const LAYOUT_CONFIG = {
  ranksep: RANK_SEPARATION,
  nodesep: NODE_SEPARATION,
  edgeCurve: "smoothstep",
  edgeOffsetStep: 12,
};
export const DEFAULT_FEATURE_FLAGS = {
  ephemeralClamp: true,
  edgeStraightening: true,
  anchorHandles: true,
  layoutFreeform: false,
  causalFlow: true,
  causalLagMs: 50,
  flowPulseMs: 900,
  stylePreset: "causion",
  edgeEffectLabels: false,
};
export const DEFAULT_NOISE_SCALE = 0.1;
export const NOISE_SCALE_MAX = 0.5;
export const NOISE_SCALE_STEP = 0.01;
// Set sampling speed for "Visualize" scatterplot. 
export const SCATTER_SAMPLE_INTERVAL_MS = 100;
// Set speeds for auto slide and random value updates.
export const AUTO_SLIDE_PERIOD_SECONDS = 4;
export const RANDOM_UPDATE_INTERVAL_MS = 100;

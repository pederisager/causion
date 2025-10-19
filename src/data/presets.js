// Preset SCM definitions and helper math utilities used across the app.
// Keeping these strings centralized lets us share them between UI panels
// and tests while making it easier for beginners to discover available
// examples.

export const PRESET_MEDIATION = `Med = 0.5*A\nB = 0.5*Med`;
export const PRESET_CONFOUNDING = `A = 0.5*Con\nB = 0.5*Con`;
export const PRESET_COLLIDER = `Col = 0.5*A + 0.5*B`;

export const PRESETS = [
  { key: "mediation", label: "Load Mediation", text: PRESET_MEDIATION },
  { key: "confounding", label: "Load Confounding", text: PRESET_CONFOUNDING },
  { key: "collider", label: "Load Collider", text: PRESET_COLLIDER },
];

// Triangular waveform helper used for the autoplay feature. Accepts a phase
// in the range [0, 1) and returns a value that rises from 0 to 1 then falls
// back to 0, giving a smooth loop for slider animations.
export function tri(phase) {
  const p = Number.isFinite(phase) ? phase : 0;
  const t = p - Math.floor(p);
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

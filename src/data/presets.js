// Preset SCM definitions and helper math utilities used across the app.
// Keeping these strings centralized lets us share them between UI panels
// and tests while making it easier for beginners to discover available
// examples.

export const PRESET_MEDIATION = `M = X\nY = M`;
export const PRESET_CONFOUNDING = `X = C\nY = C`;
export const PRESET_COLLIDER = `C = X + Y`;
export const PRESET_COMPLEX = `X = Con\nM = X\nY=Con+M\nCol=X+Y`;
export const PRESET_SIMPLE = `Y = X`;

export const PRESETS = [
  { key: "simple", label: "Load Y = X", text: PRESET_SIMPLE },
  { key: "mediation", label: "Load Mediation", text: PRESET_MEDIATION },
  { key: "confounding", label: "Load Confounding", text: PRESET_CONFOUNDING },
  { key: "collider", label: "Load Collider", text: PRESET_COLLIDER },
    { key: "complex", label: "Load Complex DAG", text: PRESET_COMPLEX },
];

// Triangular waveform helper used for the autoplay feature. Accepts a phase
// in the range [0, 1) and returns a value that rises from 0 to 1 then falls
// back to 0, giving a smooth loop for slider animations.
export function tri(phase) {
  const p = Number.isFinite(phase) ? phase : 0;
  const t = p - Math.floor(p);
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

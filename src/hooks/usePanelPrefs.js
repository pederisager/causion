import { useEffect, useState } from "react";

const STORAGE_KEY = "causion.dataPanel.prefs";
const DEFAULT_PREFS = {
  isOpen: false,
  dockPreference: "right",
  sizeRightPx: 360,
  sizeBottomPx: 320,
};

function sanitizePrefs(raw) {
  const next = { ...DEFAULT_PREFS, ...(raw || {}) };
  next.isOpen = Boolean(next.isOpen);
  next.dockPreference = next.dockPreference === "bottom" ? "bottom" : "right";
  next.sizeRightPx = Number.isFinite(Number(next.sizeRightPx))
    ? Number(next.sizeRightPx)
    : DEFAULT_PREFS.sizeRightPx;
  next.sizeBottomPx = Number.isFinite(Number(next.sizeBottomPx))
    ? Number(next.sizeBottomPx)
    : DEFAULT_PREFS.sizeBottomPx;
  return next;
}

export function usePanelPrefs() {
  const [prefs, setPrefs] = useState(() => {
    if (typeof window === "undefined") return { ...DEFAULT_PREFS };
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return { ...DEFAULT_PREFS };
      return sanitizePrefs(JSON.parse(stored));
    } catch (error) {
      return { ...DEFAULT_PREFS };
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      // Ignore write failures (e.g., storage blocked).
    }
  }, [prefs]);

  const updatePrefs = (next) => {
    setPrefs((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      return sanitizePrefs({ ...prev, ...(resolved || {}) });
    });
  };

  return [prefs, updatePrefs];
}

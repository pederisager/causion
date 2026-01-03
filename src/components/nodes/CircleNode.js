import React from "react";
import { Handle, Position } from "reactflow";
import { NODE_WIDTH, NODE_HEIGHT } from "../constants.js";

const CAUSION_NEUTRAL = [251, 249, 244];
const CAUSION_POS_LIGHT = [220, 232, 246];
const CAUSION_POS_DEEP = [74, 140, 205];
const CAUSION_NEG_LIGHT = [244, 222, 205];
const CAUSION_NEG_DEEP = [232, 104, 30];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function blendChannel(from, to, t) {
  return Math.round(from + (to - from) * t);
}

function mixColors(base, target, t) {
  return [
    blendChannel(base[0], target[0], t),
    blendChannel(base[1], target[1], t),
    blendChannel(base[2], target[2], t),
  ];
}

function colorToCss(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function valueToColorMinimal(value, range = 100) {
  const clamped = clamp(Number.isFinite(value) ? value : 0, -range, range);
  const absNorm = Math.min(Math.abs(clamped) / range, 1);
  const neutralBand = 0.25;
  if (absNorm <= neutralBand) {
    return colorToCss(mixColors([255, 255, 255], [248, 248, 248], Math.pow(absNorm / neutralBand, 0.8)));
  }
  const shifted = Math.pow((absNorm - neutralBand) / (1 - neutralBand), 0.85);
  if (clamped >= 0) {
    const fill = mixColors([232, 239, 250], [90, 148, 206], shifted);
    return colorToCss(fill);
  }
  const fill = mixColors([250, 231, 214], [224, 108, 34], shifted);
  return colorToCss(fill);
}

function getThemePreset(dataPreset) {
  if (dataPreset) return dataPreset;
  if (typeof document === "undefined") return "minimal";
  const body = document.body;
  if (!body) return "minimal";
  return body.classList.contains("theme-causion") ? "causion" : "minimal";
}

function computeCausionFill(value, min, max) {
  const limit = clamp(Math.max(Math.abs(min), Math.abs(max)), 1, Number.MAX_SAFE_INTEGER);
  const norm = clamp((Number(value) || 0) / limit, -1, 1);
  const absNorm = Math.abs(norm);
  const neutralBand = 0.28;
  const palette = norm >= 0
    ? { soft: CAUSION_POS_LIGHT, deep: CAUSION_POS_DEEP }
    : { soft: CAUSION_NEG_LIGHT, deep: CAUSION_NEG_DEEP };
  let fillRgb;
  if (absNorm <= neutralBand) {
    const ratio = Math.pow(absNorm / neutralBand, 0.6);
    fillRgb = mixColors(CAUSION_NEUTRAL, palette.soft, ratio * 0.4);
  } else {
    const shifted = (absNorm - neutralBand) / (1 - neutralBand);
    const towardSoft = mixColors(CAUSION_NEUTRAL, palette.soft, 0.35 + shifted * 0.4);
    fillRgb = mixColors(towardSoft, palette.deep, Math.pow(shifted, 0.85));
  }
  return {
    fill: colorToCss(fillRgb),
    intensity: absNorm,
    polarity: Math.sign(norm),
  };
}

export default function CircleNode({ data }) {
  const { id, value, min = -100, max = 100, stylePreset, doActive, isControlled } = data || {};
  const themePreset = getThemePreset(stylePreset);
  const rangeScale = Math.max(Math.abs(min), Math.abs(max));

  const containerBaseStyle = {
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    userSelect: "none",
    textAlign: "center",
    padding: themePreset === "causion" ? 8 : 0,
    overflow: "hidden",
    transition: "background-color 280ms ease, box-shadow 200ms ease, border-color 200ms ease",
  };

  const valueStyle = {
    fontSize: themePreset === "causion" ? 14 : 14,
    fontWeight: 600,
    marginTop: themePreset === "causion" ? 4 : 6,
    opacity: 0.9,
    fontFamily: themePreset === "causion" ? "var(--font-mono)" : undefined,
    color: themePreset === "causion" ? "var(--color-text-muted)" : undefined,
  };

  const labelStyle = {
    fontSize: themePreset === "causion" ? 18 : 22,
    fontWeight: themePreset === "causion" ? 600 : 800,
    letterSpacing: themePreset === "causion" ? "0.08em" : undefined,
    fontFamily: themePreset === "causion" ? "var(--font-mono)" : undefined,
    maxWidth: "80%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  let containerStyle = { ...containerBaseStyle, position: "relative" };
  let containerClassName;

  if (themePreset === "causion") {
    const { fill, intensity, polarity } = computeCausionFill(value, min, max);
    const baseInset = `inset 0 0 0 ${0.6 + intensity * 1.6}px rgba(0,0,0,0.08)`;
    const haloOuter = doActive ? ", 0 0 0 3px rgba(63,58,52,0.18)" : "";
    containerStyle = {
      ...containerStyle,
      background: fill,
      border: "2px solid #1f1a17",
      boxShadow: baseInset + haloOuter,
    };
    labelStyle.color = polarity < 0 ? "#3b2621" : "var(--color-text)";
    containerClassName = "causion-node";
  } else {
    containerStyle = {
      ...containerStyle,
      background: valueToColorMinimal(value, rangeScale),
      border: "3px solid #111",
      boxShadow: `0 10px 24px rgba(0,0,0,0.15)${doActive ? ", 0 0 0 3px rgba(17,17,17,0.18)" : ""}`,
      fontWeight: 800,
      fontSize: 22,
    };
  }

  const badge = doActive
    ? React.createElement(
        "div",
        {
          "aria-label": "do() intervention",
          title: "do() intervention",
          style: {
            position: "absolute",
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            padding: themePreset === "causion" ? "1px 10px 2px" : "1px 10px 2px",
            borderRadius: 12,
            fontSize: 10,
            letterSpacing: themePreset === "causion" ? "0.08em" : 0,
            fontFamily: themePreset === "causion" ? "var(--font-mono)" : "sans-serif",
            background: themePreset === "causion" ? "var(--color-bg-panel)" : "rgba(248,250,252,0.95)",
            border: themePreset === "causion" ? "1px solid var(--color-ink-border)" : "1px solid rgba(17,17,17,0.1)",
            color: themePreset === "causion" ? "var(--color-text-muted)" : "#4b5563",
            boxShadow: themePreset === "causion" ? "inset 0 0 0 0.5px rgba(47,41,35,0.12)" : "0 1px 2px rgba(17,17,17,0.08)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          },
        },
        "do()"
      )
    : null;

  const hatch = isControlled
    ? React.createElement("div", {
        "aria-hidden": true,
        style: {
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          backgroundImage:
            themePreset === "causion"
              ? "repeating-linear-gradient(45deg, rgba(31,26,23,0.18) 0 6px, rgba(255,255,255,0.12) 6px 12px)"
              : "repeating-linear-gradient(45deg, rgba(15,23,42,0.18) 0 6px, rgba(255,255,255,0.3) 6px 12px)",
          opacity: 0.45,
          pointerEvents: "none",
        },
      })
    : null;

  return React.createElement(
    "div",
    { className: containerClassName, style: containerStyle },
    hatch,
    badge,
    React.createElement("div", { style: labelStyle }, id),
    React.createElement("div", { style: valueStyle }, Number(value ?? 0).toFixed(2)),
    React.createElement(Handle, {
      id: "T_t",
      type: "target",
      position: Position.Top,
      style: { opacity: 0 },
    }),
    React.createElement(Handle, {
      id: "R_t",
      type: "target",
      position: Position.Right,
      style: { opacity: 0 },
    }),
    React.createElement(Handle, {
      id: "B_t",
      type: "target",
      position: Position.Bottom,
      style: { opacity: 0 },
    }),
    React.createElement(Handle, {
      id: "L_t",
      type: "target",
      position: Position.Left,
      style: { opacity: 0 },
    }),
    React.createElement(Handle, {
      id: "T_s",
      type: "source",
      position: Position.Top,
      style: { opacity: 0 },
    }),
    React.createElement(Handle, {
      id: "R_s",
      type: "source",
      position: Position.Right,
      style: { opacity: 0 },
    }),
    React.createElement(Handle, {
      id: "B_s",
      type: "source",
      position: Position.Bottom,
      style: { opacity: 0 },
    }),
    React.createElement(Handle, {
      id: "L_s",
      type: "source",
      position: Position.Left,
      style: { opacity: 0 },
    }),
  );
}

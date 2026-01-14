import React from "react";
import { Handle, Position } from "reactflow";
import { NOISE_NODE_SIZE } from "../constants.js";

function getThemePreset(dataPreset) {
  if (dataPreset) return dataPreset;
  if (typeof document === "undefined") return "minimal";
  const body = document.body;
  if (!body) return "minimal";
  return body.classList.contains("theme-causion") ? "causion" : "minimal";
}

export default function NoiseNode({ data }) {
  const { label, stylePreset } = data || {};
  const themePreset = getThemePreset(stylePreset);
  const isCausion = themePreset === "causion";

  const containerStyle = {
    width: NOISE_NODE_SIZE,
    height: NOISE_NODE_SIZE,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.35,
    pointerEvents: "none",
  };

  const bubbleSize = Math.round(NOISE_NODE_SIZE * 0.88);
  const bubbleStyle = {
    width: bubbleSize,
    height: bubbleSize,
    borderRadius: "9999px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: isCausion ? "1px dashed var(--color-ink-border)" : "1px dashed rgba(15, 23, 42, 0.35)",
    background: isCausion ? "rgba(251, 249, 244, 0.4)" : "rgba(248, 250, 252, 0.5)",
    boxShadow: isCausion ? "inset 0 0 0 1px rgba(63, 58, 52, 0.06)" : "none",
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: isCausion ? "0.08em" : "0.04em",
    fontFamily: isCausion ? "var(--font-mono)" : "ui-monospace, SFMono-Regular, Menlo, monospace",
    color: isCausion ? "var(--color-text-muted)" : "#475569",
    lineHeight: 1.1,
  };

  return React.createElement(
    "div",
    { style: containerStyle },
    React.createElement(
      "div",
      { style: bubbleStyle },
      React.createElement("div", { style: labelStyle }, label || "U")
    ),
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
    })
  );
}

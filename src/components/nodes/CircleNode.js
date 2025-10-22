import React from "react";
import { Handle, Position } from "reactflow";
import { NODE_WIDTH, NODE_HEIGHT } from "../constants.js";

function valueToColor(value, range = 100) {
  const clamped = Math.max(-range, Math.min(range, Number(value) || 0));
  const t = Math.min(Math.abs(clamped) / range, 1);
  if (clamped >= 0) {
    const r = Math.round(255 * (1 - t));
    const g = 255;
    const b = Math.round(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
  }
  const r = 255;
  const g = Math.round(255 * (1 - t));
  const b = Math.round(255 * (1 - t));
  return `rgb(${r},${g},${b})`;
}

export default function CircleNode({ data }) {
  const { id, value, min = -100, max = 100 } = data;
  const rangeScale = Math.max(Math.abs(min), Math.abs(max));

  const valueStyle = {
    fontSize: 14,
    fontWeight: 600,
    opacity: 0.8,
    marginTop: 6,
  };

  const containerStyle = {
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    borderRadius: "50%",
    background: valueToColor(value, rangeScale),
    border: "3px solid #111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    fontWeight: 800,
    fontSize: 22,
    boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
    userSelect: "none",
  };

  return React.createElement(
    "div",
    { style: containerStyle },
    React.createElement("div", null, id),
    React.createElement("div", { style: valueStyle }, Number(value ?? 0).toFixed(2)),
    React.createElement(Handle, { id: "T_t", type: "target", position: Position.Top, style: { opacity: 0 } }),
    React.createElement(Handle, { id: "R_t", type: "target", position: Position.Right, style: { opacity: 0 } }),
    React.createElement(Handle, { id: "B_t", type: "target", position: Position.Bottom, style: { opacity: 0 } }),
    React.createElement(Handle, { id: "L_t", type: "target", position: Position.Left, style: { opacity: 0 } }),
    React.createElement(Handle, { id: "T_s", type: "source", position: Position.Top, style: { opacity: 0 } }),
    React.createElement(Handle, { id: "R_s", type: "source", position: Position.Right, style: { opacity: 0 } }),
    React.createElement(Handle, { id: "B_s", type: "source", position: Position.Bottom, style: { opacity: 0 } }),
    React.createElement(Handle, { id: "L_s", type: "source", position: Position.Left, style: { opacity: 0 } }),
  );
}

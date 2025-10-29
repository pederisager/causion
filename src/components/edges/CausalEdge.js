import React from "react";
import { getStraightPath } from "reactflow";

function getThemePreset() {
  if (typeof document === "undefined") return "minimal";
  const body = document.body;
  if (!body) return "minimal";
  return body.classList.contains("theme-causion") ? "causion" : "minimal";
}

export default function CausalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const hot = Boolean(data?.hot);
  const pulseMs = Math.max(100, Number(data?.pulseMs ?? 800));
  const animationSeconds = Math.max(0.3, pulseMs / 800);
  const themePreset = data?.stylePreset ? data.stylePreset : getThemePreset();

  const strokeColor = themePreset === "causion" ? "var(--color-ink-line)" : "#111";
  const chilledStroke = themePreset === "causion" ? 1.6 : 2;
  const hotStroke = themePreset === "causion" ? 2.4 : 3;

  const baseClass = themePreset === "causion" ? "causion-edge graphite-line" : undefined;
  const basePath = React.createElement("path", {
    d: edgePath,
    fill: "none",
    stroke: strokeColor,
    strokeWidth: hot ? hotStroke : chilledStroke,
    className: baseClass,
  });

  const marchingAnts =
    hot
      ? React.createElement("path", {
          d: edgePath,
          fill: "none",
          stroke: themePreset === "causion" ? "rgba(255,255,255,0.55)" : "#fff",
          strokeWidth: themePreset === "causion" ? hotStroke + 0.4 : hotStroke + 0.5,
          strokeDasharray: "8 8",
          strokeLinecap: "butt",
          style: { animation: `antsForward ${animationSeconds}s linear infinite` },
        })
      : null;

  const markerDef =
    themePreset === "causion"
      ? React.createElement(
          "defs",
          null,
          React.createElement(
            "marker",
            {
              id: `arrow-${id}`,
              markerWidth: 10,
              markerHeight: 10,
              refX: 8,
              refY: 3,
              orient: "auto",
              markerUnits: "strokeWidth",
            },
            React.createElement("path", {
              d: "M0,0 L6,3 L0,6",
              className: "causion-arrowhead",
              fill: "none",
              stroke: strokeColor,
              strokeWidth: 1.5,
              strokeLinecap: "round",
            })
          )
        )
      : React.createElement(
          "defs",
          null,
          React.createElement(
            "marker",
            {
              id: `arrow-${id}`,
              markerWidth: "10",
              markerHeight: "10",
              refX: "9",
              refY: "3",
              orient: "auto",
              markerUnits: "strokeWidth",
            },
            React.createElement("path", { d: "M0,0 L0,6 L9,3 z", fill: "#111" })
          )
        );

  const arrowPath = React.createElement("path", {
    d: edgePath,
    fill: "none",
    stroke: "transparent",
    strokeWidth: themePreset === "causion" ? chilledStroke : 2,
    markerEnd: `url(#arrow-${id})`,
  });

  return React.createElement("g", null, basePath, marchingAnts, markerDef, arrowPath);
}

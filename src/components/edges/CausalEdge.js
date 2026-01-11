import React from "react";
import { getStraightPath } from "reactflow";

function getThemePreset() {
  if (typeof document === "undefined") return "minimal";
  const body = document.body;
  if (!body) return "minimal";
  return body.classList.contains("theme-causion") ? "causion" : "minimal";
}

const DISABLED_STROKE_OPACITY = 0.38;
const DISABLED_MARKER_OPACITY = 0.2;

export default function CausalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}) {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const disabledByDo = Boolean(data?.disabledByDo);
  const hot = disabledByDo ? false : Boolean(data?.hot);
  const pulseMs = Math.max(100, Number(data?.pulseMs ?? 800));
  const animationSeconds = Math.max(0.3, pulseMs / 800);
  const themePreset = data?.stylePreset ? data.stylePreset : getThemePreset();
  const label = typeof data?.effectLabel === "string" ? data.effectLabel.trim() : "";

  const strokeColor = (() => {
    if (disabledByDo) {
      return themePreset === "causion" ? "var(--color-ink-border)" : "#cbd5e1";
    }
    return themePreset === "causion" ? "var(--color-ink-line)" : "#111";
  })();
  const chilledStroke = themePreset === "causion" ? 1.6 : 2;
  const hotStroke = themePreset === "causion" ? 2.4 : 3;

  const baseClass = disabledByDo
    ? undefined
    : themePreset === "causion"
    ? "causion-edge graphite-line"
    : undefined;
  const basePath = React.createElement("path", {
    d: edgePath,
    fill: "none",
    stroke: strokeColor,
    strokeWidth: hot ? hotStroke : chilledStroke,
    className: baseClass,
    opacity: disabledByDo ? DISABLED_STROKE_OPACITY : 1,
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

  const marker =
    themePreset === "causion"
      ? React.createElement(
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
            opacity: disabledByDo ? DISABLED_MARKER_OPACITY : 1,
          })
        )
      : React.createElement(
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
          React.createElement("path", {
            d: "M0,0 L0,6 L9,3 z",
            fill: disabledByDo ? "#cbd5e1" : "#111",
            opacity: disabledByDo ? DISABLED_MARKER_OPACITY : 1,
          })
        );

  const defs = React.createElement("defs", null, marker);

  const arrowPath = React.createElement("path", {
    d: edgePath,
    fill: "none",
    stroke: "transparent",
    strokeWidth: themePreset === "causion" ? chilledStroke : 2,
    markerEnd: `url(#arrow-${id})`,
  });

  const themeClass = themePreset === "causion" ? "edge-label--causion" : "edge-label--minimal";
  const labelClassName = ["edge-label", themeClass, hot ? "edge-label--hot" : ""]
    .filter(Boolean)
    .join(" ");

  const textPaddingX = 6;
  const textPaddingY = 3;
  const approxCharWidth = 7.2;
  const approxHeight = 12;
  const backgroundFill = "#f5f2e8";

  const labelElement =
    label && Number.isFinite(labelX) && Number.isFinite(labelY)
      ? (() => {
          const width = Math.max(label.length * approxCharWidth + textPaddingX * 2, 18);
          const height = approxHeight + textPaddingY * 2;
          const rectX = labelX - width / 2;
          const rectY = labelY - height / 2;
          const rect = React.createElement("rect", {
            x: rectX,
            y: rectY,
            rx: 4,
            ry: 4,
            width,
            height,
            fill: backgroundFill,
          });
          const textEl = React.createElement(
            "text",
            {
              x: labelX,
              y: labelY,
              textAnchor: "middle",
              dominantBaseline: "middle",
              className: labelClassName,
            },
            label
          );
          return React.createElement(
            "g",
            {
              transformOrigin: `${labelX} ${labelY}`,
              style: { pointerEvents: "none" },
            },
            rect,
            textEl
          );
        })()
      : null;

  return React.createElement("g", null, basePath, marchingAnts, defs, arrowPath, labelElement);
}

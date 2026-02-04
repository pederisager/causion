import React, { useEffect, useRef, useState } from "react";
import { EdgeLabelRenderer, getStraightPath } from "reactflow";

function getThemePreset() {
  if (typeof document === "undefined") return "minimal";
  const body = document.body;
  if (!body) return "minimal";
  return body.classList.contains("theme-causion") ? "causion" : "minimal";
}

function getEdgeConnectionGap() {
  if (typeof document === "undefined") return 0;
  const root = document.documentElement;
  if (!root) return 0;
  const raw = getComputedStyle(root).getPropertyValue("--edge-connection-gap");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function applyEdgeGap(sourceX, sourceY, targetX, targetY, gap) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) {
    return { sourceX, sourceY, targetX, targetY };
  }
  const safeGap = Math.max(0, Math.min(gap, length / 2));
  if (safeGap === 0) {
    return { sourceX, sourceY, targetX, targetY };
  }
  const unitX = dx / length;
  const unitY = dy / length;
  return {
    sourceX: sourceX + unitX * safeGap,
    sourceY: sourceY + unitY * safeGap,
    targetX: targetX - unitX * safeGap,
    targetY: targetY - unitY * safeGap,
  };
}

function isFinitePoint(point) {
  return (
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}

function applyCircularAnchors(sourceX, sourceY, targetX, targetY, data) {
  const sourceCenter = data?.sourceCenter;
  const targetCenter = data?.targetCenter;
  const sourceRadius = Number.isFinite(data?.sourceRadius) ? data.sourceRadius : null;
  const targetRadius = Number.isFinite(data?.targetRadius) ? data.targetRadius : null;
  if (!isFinitePoint(sourceCenter) || !isFinitePoint(targetCenter)) {
    return { sourceX, sourceY, targetX, targetY };
  }
  if (!Number.isFinite(sourceRadius) || !Number.isFinite(targetRadius)) {
    return { sourceX, sourceY, targetX, targetY };
  }
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) {
    return { sourceX, sourceY, targetX, targetY };
  }
  const unitX = dx / length;
  const unitY = dy / length;
  return {
    sourceX: sourceCenter.x + unitX * sourceRadius,
    sourceY: sourceCenter.y + unitY * sourceRadius,
    targetX: targetCenter.x - unitX * targetRadius,
    targetY: targetCenter.y - unitY * targetRadius,
  };
}

const DISABLED_STROKE_OPACITY = 0.38;
const DISABLED_MARKER_OPACITY = 0.2;

export default function CausalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  interactionWidth,
  data,
  selected,
}) {
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [localError, setLocalError] = useState("");
  const inputRef = useRef(null);

  const edgeGap = getEdgeConnectionGap();
  const circularAnchors = applyCircularAnchors(sourceX, sourceY, targetX, targetY, data);
  const { sourceX: adjustedSourceX, sourceY: adjustedSourceY, targetX: adjustedTargetX, targetY: adjustedTargetY } =
    applyEdgeGap(circularAnchors.sourceX, circularAnchors.sourceY, circularAnchors.targetX, circularAnchors.targetY, edgeGap);
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
  });
  const disabledByDo = Boolean(data?.disabledByDo);
  const dsepColor = typeof data?.dsepColor === "string" ? data.dsepColor : "";
  const hasDsepColor = !disabledByDo && dsepColor;
  const hot = disabledByDo ? false : Boolean(data?.hot);
  const pulseMs = Math.max(100, Number(data?.pulseMs ?? 800));
  const animationSeconds = Math.max(0.3, pulseMs / 800);
  const themePreset = data?.stylePreset ? data.stylePreset : getThemePreset();
  const labelVisible = Boolean(data?.showLabel || selected);
  const rawLabel = typeof data?.effectLabel === "string" ? data.effectLabel.trim() : "";
  const label = labelVisible ? rawLabel : "";
  const coefficient = Number.isFinite(data?.edgeCoefficient) ? data.edgeCoefficient : null;
  const allowEdit = labelVisible && Boolean(data?.allowLabelEdit) && Number.isFinite(coefficient);

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(Number.isFinite(coefficient) ? String(coefficient) : "");
      setLocalError("");
    }
  }, [coefficient, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (typeof inputRef.current.select === "function") {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const strokeColor = (() => {
    if (disabledByDo) {
      return themePreset === "causion" ? "var(--color-ink-border)" : "#cbd5e1";
    }
    if (hasDsepColor) {
      return dsepColor;
    }
    return themePreset === "causion" ? "var(--color-ink-line)" : "#111";
  })();
  const chilledStroke = themePreset === "causion" ? 1.6 : 2;
  const hotStroke = themePreset === "causion" ? 2.4 : 3;

  const baseClass =
    disabledByDo || hasDsepColor
      ? undefined
      : themePreset === "causion"
      ? "causion-edge graphite-line"
      : undefined;
  const hitAreaWidth = Number.isFinite(interactionWidth)
    ? Math.max(interactionWidth, chilledStroke + 6)
    : chilledStroke + 10;
  const interactionPath = React.createElement("path", {
    d: edgePath,
    fill: "none",
    stroke: "transparent",
    strokeWidth: hitAreaWidth,
    pointerEvents: "stroke",
    strokeLinecap: "round",
    "data-edge-hitbox": "true",
  });
  const basePath = React.createElement("path", {
    d: edgePath,
    fill: "none",
    stroke: strokeColor,
    strokeWidth: hot ? hotStroke : chilledStroke,
    className: baseClass,
    opacity: disabledByDo ? DISABLED_STROKE_OPACITY : 1,
  });

  const selectedHalo = selected
    ? React.createElement("path", {
        d: edgePath,
        fill: "none",
        stroke: themePreset === "causion" ? "rgba(63, 58, 52, 0.2)" : "rgba(148, 163, 184, 0.45)",
        strokeWidth: (hot ? hotStroke : chilledStroke) + 6,
        strokeLinecap: "round",
        pointerEvents: "none",
      })
    : null;

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
            id: `arrow-${safeId}`,
            markerWidth: 10,
            markerHeight: 10,
            refX: 8,
            refY: 3,
            orient: "auto",
            markerUnits: "strokeWidth",
          },
          React.createElement("path", {
            d: "M0,0 L6,3 L0,6",
            className: hasDsepColor ? undefined : "causion-arrowhead",
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
            id: `arrow-${safeId}`,
            markerWidth: "10",
            markerHeight: "10",
            refX: "9",
            refY: "3",
            orient: "auto",
            markerUnits: "strokeWidth",
          },
          React.createElement("path", {
            d: "M0,0 L0,6 L9,3 z",
            fill: disabledByDo ? "#cbd5e1" : strokeColor,
            opacity: disabledByDo ? DISABLED_MARKER_OPACITY : 1,
          })
        );

  const defs = React.createElement("defs", null, marker);

  const arrowPath = React.createElement("path", {
    d: edgePath,
    fill: "none",
    stroke: "transparent",
    strokeWidth: themePreset === "causion" ? chilledStroke : 2,
    markerEnd: `url(#arrow-${safeId})`,
  });

  const themeClass = themePreset === "causion" ? "edge-label--causion" : "edge-label--minimal";
  const labelClassName = ["edge-label", themeClass, hot ? "edge-label--hot" : ""]
    .filter(Boolean)
    .join(" ");

  const handleCommit = () => {
    if (!allowEdit) return;
    const next = Number.parseFloat(draftValue);
    if (!Number.isFinite(next)) {
      setLocalError("Enter a number.");
      return;
    }
    if (Number.isFinite(coefficient) && Math.abs(next - coefficient) < 1e-9) {
      setIsEditing(false);
      setLocalError("");
      return;
    }
    data?.onEdgeCoefficientCommit?.(id, next);
    setIsEditing(false);
    setLocalError("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalError("");
    setDraftValue(Number.isFinite(coefficient) ? String(coefficient) : "");
  };

  const handleLabelClick = (event) => {
    event.stopPropagation();
    if (!allowEdit || isEditing) return;
    setIsEditing(true);
  };

  const labelElement =
    label && Number.isFinite(labelX) && Number.isFinite(labelY)
      ? React.createElement(
          EdgeLabelRenderer,
          null,
          React.createElement(
            "div",
            {
              className: [
                "edge-label__container",
                themePreset === "causion" ? "edge-label__container--causion" : "edge-label__container--minimal",
                allowEdit ? "edge-label__container--editable" : "",
              ]
                .filter(Boolean)
                .join(" "),
              style: {
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              },
              onClick: handleLabelClick,
            },
            isEditing
              ? React.createElement("input", {
                  ref: inputRef,
                  type: "text",
                  inputMode: "decimal",
                  className: "edge-label__input",
                  value: draftValue,
                  onChange: (event) => {
                    setDraftValue(event.target.value);
                    setLocalError("");
                  },
                  onKeyDown: (event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCommit();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      handleCancel();
                    }
                  },
                  onBlur: handleCommit,
                })
              : React.createElement(
                  "span",
                  {
                    className: labelClassName,
                  },
                  label
                ),
            localError
              ? React.createElement(
                  "div",
                  { className: "edge-label__error" },
                  localError
                )
              : null
          )
        )
      : null;

  return React.createElement(
    "g",
    null,
    interactionPath,
    selectedHalo,
    basePath,
    marchingAnts,
    defs,
    arrowPath,
    labelElement
  );
}

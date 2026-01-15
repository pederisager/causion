import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SCATTER_SAMPLE_INTERVAL_MS } from "./constants.js";
import {
  buildLinearLine,
  buildLoessLine,
  computeResidualizedSamples,
} from "../utils/regressionUtils.js";
import {
  generateSamples,
  getUserVariables,
  samplesToCSV,
  downloadCSV,
} from "../utils/csvSimulation.js";

function detectThemePreset(explicitPreset) {
  if (explicitPreset) return explicitPreset;
  if (typeof document === "undefined") return "minimal";
  const body = document.body;
  if (!body) return "minimal";
  return body.classList.contains("theme-causion") ? "causion" : "minimal";
}

function getDefaultAxes(options) {
  if (!options.length) {
    return { x: "", y: "" };
  }
  if (options.length === 1) {
    return { x: options[0], y: options[0] };
  }
  return { x: options[0], y: options[1] };
}

function normalizeDomain([min, max]) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [-1, 1];
  }
  if (min === max) {
    const padding = Math.abs(min || 1);
    return [min - padding, max + padding];
  }
  return [min, max];
}

function buildTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const span = max - min;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function ScatterPlot({ samples, xLabel, yLabel, themePreset, linePoints, xDomain, yDomain }) {
  const width = 360;
  const height = 360;
  const margin = { top: 20, right: 20, bottom: 56, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const isCausion = themePreset === "causion";
  const panelFill = isCausion ? "rgba(72, 106, 124, 0.08)" : "rgba(15, 118, 110, 0.05)";
  const axisColor = isCausion ? "var(--color-ink-line)" : "#0f172a";
  const pointFill = isCausion ? "var(--color-ink-line)" : "#0ea5e9";
  const pointStroke = isCausion ? "var(--color-bg-panel)" : "white";
  const lineStroke = isCausion ? "var(--color-text)" : "#f97316";

  const xs = samples.map((sample) => sample.x);
  const ys = samples.map((sample) => sample.y);
  const fallbackDomainX = normalizeDomain([
    xs.length ? Math.min(...xs) : -1,
    xs.length ? Math.max(...xs) : 1,
  ]);
  const fallbackDomainY = normalizeDomain([
    ys.length ? Math.min(...ys) : -1,
    ys.length ? Math.max(...ys) : 1,
  ]);
  const domainX = xDomain ? normalizeDomain(xDomain) : fallbackDomainX;
  const domainY = yDomain ? normalizeDomain(yDomain) : fallbackDomainY;

  const scaleX = (value) => {
    const [min, max] = domainX;
    if (max === min) return margin.left + innerWidth / 2;
    return margin.left + ((value - min) / (max - min)) * innerWidth;
  };

  const scaleY = (value) => {
    const [min, max] = domainY;
    if (max === min) return margin.top + innerHeight / 2;
    return margin.top + (1 - (value - min) / (max - min)) * innerHeight;
  };

  const ticksX = buildTicks(domainX[0], domainX[1]);
  const ticksY = buildTicks(domainY[0], domainY[1]);

  const linePath =
    linePoints && linePoints.length > 1
      ? linePoints.map((point) => `${scaleX(point.x)},${scaleY(point.y)}`).join(" ")
      : null;

  const svgStyle = isCausion
    ? {
        backgroundColor: "var(--color-bg-panel)",
        borderColor: "var(--color-ink-border)",
        width: "100%",
        height: "100%",
      }
    : { width: "100%", height: "100%" };

  return (
    <div className="w-full" style={{ height: "min(55vh, 540px)" }}>
      <svg
        role="img"
        aria-label={
          samples.length
            ? `Scatterplot of ${xLabel} versus ${yLabel}`
            : "Empty scatterplot"
        }
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className={isCausion ? "rounded border w-full h-full" : "rounded border bg-white w-full h-full"}
        style={svgStyle}
      >
        <rect
          x={margin.left}
          y={margin.top}
          width={innerWidth}
          height={innerHeight}
          fill={panelFill}
        />
        <line
          x1={margin.left}
          y1={margin.top + innerHeight}
          x2={margin.left + innerWidth}
          y2={margin.top + innerHeight}
          stroke={axisColor}
          strokeWidth={1}
        />
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + innerHeight}
          stroke={axisColor}
          strokeWidth={1}
        />
        {ticksX.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={scaleX(tick)}
              y1={margin.top + innerHeight}
              x2={scaleX(tick)}
              y2={margin.top + innerHeight + 6}
              stroke={axisColor}
              strokeWidth={1}
            />
            <text
              x={scaleX(tick)}
              y={height - 24}
              textAnchor="middle"
              fill={axisColor}
              style={
                isCausion
                  ? { fontFamily: "var(--font-body)", fontSize: "0.6rem", letterSpacing: "0.04em" }
                  : { fontSize: "0.6rem" }
              }
            >
              {Number.isFinite(tick) ? tick.toFixed(2) : "–"}
            </text>
          </g>
        ))}
        {ticksY.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={margin.left - 6}
              y1={scaleY(tick)}
              x2={margin.left}
              y2={scaleY(tick)}
              stroke={axisColor}
              strokeWidth={1}
            />
            <text
              x={margin.left - 10}
              y={scaleY(tick) + 3}
              textAnchor="end"
              fill={axisColor}
              style={
                isCausion
                  ? { fontFamily: "var(--font-body)", fontSize: "0.6rem", letterSpacing: "0.04em" }
                  : { fontSize: "0.6rem" }
              }
            >
              {Number.isFinite(tick) ? tick.toFixed(2) : "–"}
            </text>
          </g>
        ))}
        {linePath ? (
          <polyline points={linePath} fill="none" stroke={lineStroke} strokeWidth={2} />
        ) : null}
        {samples.map((sample) => (
          <circle
            key={sample.id ?? sample.timestamp}
            cx={scaleX(sample.x)}
            cy={scaleY(sample.y)}
            r={4}
            fill={pointFill}
            stroke={pointStroke}
            strokeWidth={1}
          />
        ))}
        <text
          x={margin.left + innerWidth / 2}
          y={height - 6}
          textAnchor="middle"
          fill={axisColor}
          style={
            isCausion
              ? { fontFamily: "var(--font-body)", fontSize: "0.7rem", letterSpacing: "0.08em" }
            : undefined
          }
        >
          {xLabel || "Select X variable"}
        </text>
        <text
          x={16}
          y={margin.top + innerHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${margin.top + innerHeight / 2})`}
          fill={axisColor}
          style={
            isCausion
              ? { fontFamily: "var(--font-body)", fontSize: "0.7rem", letterSpacing: "0.08em" }
            : undefined
          }
        >
          {yLabel || "Select Y variable"}
        </text>
      </svg>
      {!samples.length ? (
        <p className="mt-2 text-xs text-slate-500">
          No points yet. Adjust variables or wait for changes.
        </p>
      ) : null}
    </div>
  );
}

export default function DataVizPanel({
  allVars,
  values,
  themePreset,
  controlledVars = [],
  interventions = {},
  ranges = {},
  isOpen = true,
  dockMode = "right",
  dockPreference = "right",
  showDockSelector = false,
  onDockPreferenceChange = () => {},
  onControlledVarsChange = () => {},
  onClose = () => {},
  containerRef,
  headingRef,
  model,
  eqs,
  noiseConfig = { enabled: false, amount: 0 },
}) {
  const resolvedTheme = detectThemePreset(themePreset);
  const isCausion = resolvedTheme === "causion";
  const joinClasses = (...classes) => classes.filter(Boolean).join(" ");
  const options = useMemo(() => Array.from(allVars || []).sort(), [allVars]);

  const [{ x, y }, setAxes] = useState(() => getDefaultAxes(options));
  const [samples, setSamples] = useState([]);
  const [fitMode, setFitMode] = useState("none");
  const [isControlMenuOpen, setIsControlMenuOpen] = useState(false);
  const [sampleSize, setSampleSize] = useState(100);
  const [isSimulating, setIsSimulating] = useState(false);

  const intervalRef = useRef(null);
  const lastAxesRef = useRef({ x: "", y: "" });
  const lastControlsRef = useRef("");
  const valuesRef = useRef(values);
  const controlsRef = useRef(controlledVars);
  const controlMenuRef = useRef(null);

  const hasVariables = options.length > 0;

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    controlsRef.current = controlledVars;
  }, [controlledVars]);

  useEffect(() => {
    if (!Array.isArray(controlledVars)) return;
    const allowed = new Set(options);
    const filtered = controlledVars.filter((name) => allowed.has(name));
    const signature = filtered.slice().sort().join("|");
    const currentSignature = controlledVars.slice().sort().join("|");
    if (signature !== currentSignature) {
      onControlledVarsChange(filtered);
    }
  }, [controlledVars, onControlledVarsChange, options, x, y]);

  useEffect(() => {
    const defaults = getDefaultAxes(options);
    setAxes((prev) => {
      const nextX = options.includes(prev.x) ? prev.x : defaults.x;
      let nextY = options.includes(prev.y) ? prev.y : defaults.y;
      if (nextX && nextY && nextX === nextY && options.length > 1) {
        nextY = options.find((opt) => opt !== nextX) ?? nextY;
      }
      if (prev.x === nextX && prev.y === nextY) {
        return prev;
      }
      return { x: nextX, y: nextY };
    });
  }, [options]);

  useEffect(() => {
    const lastAxes = lastAxesRef.current;
    if (x && y && (x !== lastAxes.x || y !== lastAxes.y)) {
      setSamples([]);
    }
    lastAxesRef.current = { x, y };
  }, [x, y]);

  useEffect(() => {
    const signature = controlledVars.slice().sort().join("|");
    if (signature !== lastControlsRef.current) {
      setSamples([]);
      lastControlsRef.current = signature;
    }
  }, [controlledVars]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!isOpen || !hasVariables || !x || !y) {
      return undefined;
    }

    const tick = () => {
      const latestValues = valuesRef.current || {};
      const controlKeys = controlsRef.current || [];
      const trackedKeys = Array.from(new Set([x, y, ...controlKeys].filter(Boolean)));
      const sampleValues = {};
      for (const key of trackedKeys) {
        const rawValue = latestValues?.[key];
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
          return;
        }
        sampleValues[key] = numericValue;
      }
      const numericX = sampleValues[x];
      const numericY = sampleValues[y];
      setSamples((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.rawX === numericX && last.rawY === numericY) {
          return prev;
        }
        const timestamp = Date.now();
        const id =
          timestamp.toString(36) +
          "-" +
          numericX.toString(36) +
          "-" +
          numericY.toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 8);
        return [
          ...prev,
          {
            rawX: numericX,
            rawY: numericY,
            values: sampleValues,
            timestamp,
            id,
          },
        ];
      });
    };

    intervalRef.current = setInterval(tick, SCATTER_SAMPLE_INTERVAL_MS);
    tick();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasVariables, isOpen, x, y]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleClear = () => {
    setSamples([]);
  };

  const handleAxisChange = (axisKey) => (event) => {
    const nextValue = event.target.value;
    setAxes((prev) => ({ ...prev, [axisKey]: nextValue }));
  };

  const handleControlToggle = (name) => (event) => {
    const next = new Set(controlledVars);
    if (event.target.checked) {
      next.add(name);
    } else {
      next.delete(name);
    }
    const ordered = options.filter((option) => next.has(option));
    onControlledVarsChange(ordered);
  };

  const handleFitModeChange = (event) => {
    setFitMode(event.target.value);
  };

  const handleSimulate = useCallback(() => {
    if (!model || !eqs || sampleSize < 1) return;
    setIsSimulating(true);
    // Use setTimeout to avoid blocking UI during generation
    setTimeout(() => {
      try {
        const generatedSamples = generateSamples({
          model,
          eqs,
          allVars,
          values,
          interventions,
          ranges,
          noiseConfig,
          sampleCount: sampleSize,
        });
        const columns = getUserVariables(allVars);
        const csv = samplesToCSV(generatedSamples, columns);
        downloadCSV(csv, `causion-simulation-${Date.now()}.csv`);
      } catch (error) {
        console.error("Simulation error:", error);
      } finally {
        setIsSimulating(false);
      }
    }, 0);
  }, [model, eqs, allVars, values, interventions, ranges, noiseConfig, sampleSize]);

  const controlOptions = useMemo(() => options, [options]);

  const adjustedResult = useMemo(() => {
    if (!x || !y) return { points: [], status: "invalid" };
    return computeResidualizedSamples(samples, x, y, controlledVars);
  }, [controlledVars, samples, x, y]);

  const adjustedSamples = useMemo(
    () => adjustedResult.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    [adjustedResult.points]
  );

  const regressionLine = useMemo(() => {
    if (fitMode === "linear") {
      return buildLinearLine(adjustedSamples);
    }
    if (fitMode === "loess") {
      return buildLoessLine(adjustedSamples);
    }
    return null;
  }, [adjustedSamples, fitMode]);

  const helperTextStyle = isCausion
    ? { color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }
    : undefined;

  useEffect(() => {
    if (!isControlMenuOpen) return undefined;
    if (typeof document === "undefined") return undefined;
    const handleClick = (event) => {
      if (!controlMenuRef.current) return;
      if (!controlMenuRef.current.contains(event.target)) {
        setIsControlMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isControlMenuOpen]);

  const xRange = ranges?.[x];
  const yRange = ranges?.[y];
  const xDomain =
    xRange && Number.isFinite(xRange.min) && Number.isFinite(xRange.max)
      ? [xRange.min, xRange.max]
      : null;
  const yDomain =
    yRange && Number.isFinite(yRange.min) && Number.isFinite(yRange.max)
      ? [yRange.min, yRange.max]
      : null;

  const hasControls = controlledVars.length > 0;
  const controlCountLabel = hasControls ? `${controlledVars.length} selected` : "None selected";
  const needsControlAdjustment = hasControls && adjustedResult.status !== "adjusted";
  const adjustmentMessage = needsControlAdjustment
    ? adjustedResult.status === "insufficient"
      ? "Add more samples to adjust for controls."
      : adjustedResult.status === "singular"
      ? "Control adjustment failed (controls are collinear)."
      : "Control adjustment unavailable for current inputs."
    : null;

  const activeInterventions = Object.keys(interventions || {}).filter(
    (key) => interventions?.[key]
  );

  const isOverlay = dockMode === "overlay";
  const panelBaseClass = joinClasses(
    "flex h-full w-full flex-col min-h-0",
    isCausion
      ? "causion-panel"
      : "rounded-2xl border border-slate-200 bg-white shadow"
  );
  const panelShellClass = joinClasses(
    panelBaseClass,
    isOverlay ? "rounded-none" : ""
  );
  const panelStyle = {
    ...(isOverlay ? { borderRadius: 0 } : null),
    ...(isOpen ? null : { display: "none" }),
  };

  const badgeClass = joinClasses(
    "text-[0.6rem] uppercase tracking-[0.2em] px-2 py-1 rounded-full",
    isCausion
      ? "border border-[var(--color-ink-border)] text-[var(--color-text)]"
      : "border border-slate-200 text-slate-600"
  );
  const clearButtonClass = joinClasses(
    "text-[0.65rem] uppercase tracking-[0.2em] transition",
    isCausion
      ? "btn-outline"
      : "rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-800",
    samples.length === 0 && "opacity-50 cursor-not-allowed"
  );

  const dockToggleButton = (mode) =>
    joinClasses(
      "px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] rounded-full border",
      isCausion ? "border-[var(--color-ink-border)]" : "border-slate-200",
      dockPreference === mode
        ? isCausion
          ? "bg-[var(--color-ink-line)] text-white border-[var(--color-ink-line)]"
          : "bg-slate-900 text-white border-slate-900"
        : isCausion
        ? "text-[var(--color-text)]"
        : "text-slate-600"
    );

  const contextBadges = [
    activeInterventions.length ? { label: `${activeInterventions.length} do()` } : null,
  ].filter(Boolean);

  return (
    <section
      id="data-panel"
      ref={containerRef}
      className={panelShellClass}
      style={panelStyle}
      aria-hidden={!isOpen}
      role={isOverlay ? "dialog" : "region"}
      aria-modal={isOverlay ? "true" : undefined}
      aria-labelledby="data-panel-title"
    >
      <header
        className={joinClasses(
          "flex items-center justify-between gap-3 border-b px-4 py-3",
          isCausion ? "border-[var(--color-ink-border)]" : "border-slate-200"
        )}
      >
        <div className="flex items-center gap-2">
          <h2
            id="data-panel-title"
            ref={headingRef}
            tabIndex={-1}
            className={isCausion ? "h-heading text-base" : "text-base font-semibold"}
          >
            Data
          </h2>
          {contextBadges.map((badge) => (
            <span key={badge.label} className={badgeClass}>
              {badge.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {showDockSelector ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={dockToggleButton("right")}
                onClick={() => onDockPreferenceChange("right")}
              >
                Right
              </button>
              <button
                type="button"
                className={dockToggleButton("bottom")}
                onClick={() => onDockPreferenceChange("bottom")}
              >
                Bottom
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={joinClasses(
              "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]",
              isCausion
                ? "border-[var(--color-ink-border)] text-[var(--color-text)]"
                : "border-slate-200 text-slate-600"
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }}
          >
            Close
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {!hasVariables ? (
          <p className={joinClasses("text-xs", isCausion ? "" : "text-slate-500")} style={helperTextStyle}>
            No variables available to visualize.
          </p>
        ) : (
          <div className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-3">
              <ScatterPlot
                samples={adjustedSamples}
                xLabel={x}
                yLabel={y}
                themePreset={resolvedTheme}
                linePoints={regressionLine}
                xDomain={xDomain}
                yDomain={yDomain}
              />
              <div className="flex items-center justify-between gap-3">
                <span className={badgeClass}>n={samples.length}</span>
                <button
                  type="button"
                  className={clearButtonClass}
                  onClick={handleClear}
                  disabled={samples.length === 0}
                >
                  Clear samples
                </button>
              </div>
            </div>

            <div
              className={joinClasses(
                "rounded-lg border px-3 py-3",
                isCausion ? "border-[var(--color-ink-border)]" : "border-slate-200"
              )}
            >
              <p
                className={joinClasses(
                  "text-[0.7rem] uppercase tracking-[0.28em]",
                  isCausion ? "" : "text-slate-500"
                )}
                style={helperTextStyle}
              >
                Variables
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 text-xs">
                <label className="flex flex-col gap-1">
                  X axis
                  <select
                    value={x}
                    onChange={handleAxisChange("x")}
                    className={isCausion ? "causion-field text-sm" : "border rounded px-2 py-1 text-sm"}
                  >
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  Y axis
                  <select
                    value={y}
                    onChange={handleAxisChange("y")}
                    className={isCausion ? "causion-field text-sm" : "border rounded px-2 py-1 text-sm"}
                  >
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div
              className={joinClasses(
                "rounded-lg border px-3 py-3",
                isCausion ? "border-[var(--color-ink-border)]" : "border-slate-200"
              )}
            >
              <p
                className={joinClasses(
                  "text-[0.7rem] uppercase tracking-[0.28em]",
                  isCausion ? "" : "text-slate-500"
                )}
                style={helperTextStyle}
              >
                Modeling
              </p>
              <div className="mt-3 flex flex-col gap-3 text-xs">
                <label className="flex flex-col gap-1">
                  Regression line
                  <select
                    value={fitMode}
                    onChange={handleFitModeChange}
                    className={isCausion ? "causion-field text-sm" : "border rounded px-2 py-1 text-sm"}
                  >
                    <option value="none">Off</option>
                    <option value="linear">Linear</option>
                    <option value="loess">Loess</option>
                  </select>
                </label>
                <div>
                  <p
                    className={joinClasses(
                      "text-[0.7rem] uppercase tracking-[0.28em]",
                      isCausion ? "" : "text-slate-500"
                    )}
                    style={helperTextStyle}
                  >
                    Control variables
                  </p>
                  {controlOptions.length ? (
                    <div ref={controlMenuRef} className="relative mt-2">
                      <button
                        type="button"
                        onClick={() => setIsControlMenuOpen((prev) => !prev)}
                        aria-expanded={isControlMenuOpen}
                        aria-haspopup="listbox"
                        className={joinClasses(
                          "w-full flex items-center justify-between gap-2 text-xs px-2 py-1 rounded border",
                          isCausion
                            ? "border-[var(--color-ink-border)] text-[var(--color-text)]"
                            : "border-slate-300 text-slate-700"
                        )}
                      >
                        <span>{controlCountLabel}</span>
                        <span
                          aria-hidden
                          className={joinClasses(
                            "text-[0.6rem] uppercase tracking-[0.2em]",
                            isCausion ? "text-[var(--color-text-muted)]" : "text-slate-500"
                          )}
                        >
                          {isControlMenuOpen ? "Close" : "Select"}
                        </span>
                      </button>
                      {isControlMenuOpen ? (
                        <div
                          role="listbox"
                          aria-label="Control variables"
                          className={joinClasses(
                            "absolute z-20 mt-2 w-full max-h-44 overflow-auto rounded border p-2 text-xs shadow-lg",
                            isCausion
                              ? "bg-[var(--color-bg-panel)] border-[var(--color-ink-border)]"
                              : "bg-white border-slate-200"
                          )}
                        >
                          {controlOptions.map((option) => (
                            <label key={option} className="flex items-center gap-2 py-1">
                              <input
                                type="checkbox"
                                checked={controlledVars.includes(option)}
                                onChange={handleControlToggle(option)}
                                className={isCausion ? "accent-[var(--color-ink-line)]" : "accent-slate-800"}
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className={joinClasses("text-xs", isCausion ? "" : "text-slate-500")} style={helperTextStyle}>
                      No additional variables available to control for.
                    </p>
                  )}
                </div>
                {adjustmentMessage ? (
                  <p
                    className={joinClasses("text-xs", isCausion ? "" : "text-amber-700")}
                    style={helperTextStyle}
                  >
                    {adjustmentMessage}
                  </p>
                ) : null}
                <p className={joinClasses("text-xs", isCausion ? "" : "text-slate-500")} style={helperTextStyle}>
                  Points update when tracked variables change.
                </p>
              </div>
            </div>

            <div
              className={joinClasses(
                "rounded-lg border px-3 py-3",
                isCausion ? "border-[var(--color-ink-border)]" : "border-slate-200"
              )}
            >
              <p
                className={joinClasses(
                  "text-[0.7rem] uppercase tracking-[0.28em]",
                  isCausion ? "" : "text-slate-500"
                )}
                style={helperTextStyle}
              >
                Simulate
              </p>
              <div className="mt-3 flex flex-col gap-3 text-xs">
                <label className="flex flex-col gap-1">
                  Sample size
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={sampleSize}
                    onChange={(e) =>
                      setSampleSize(Math.max(1, Math.min(100000, Number(e.target.value) || 100)))
                    }
                    className={isCausion ? "causion-field text-sm" : "border rounded px-2 py-1 text-sm"}
                  />
                </label>
                <button
                  type="button"
                  className={joinClasses(
                    "px-3 py-2 rounded text-sm font-medium transition",
                    isCausion
                      ? "btn-outline"
                      : "border border-slate-300 bg-white hover:bg-slate-50",
                    isSimulating && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={handleSimulate}
                  disabled={isSimulating || !model || sampleSize < 1}
                >
                  {isSimulating ? "Generating..." : "Export CSV"}
                </button>
                <p className={joinClasses("text-xs", isCausion ? "" : "text-slate-500")} style={helperTextStyle}>
                  {noiseConfig?.enabled
                    ? `Each row varies noise nodes with Gaussian noise (scale: ${((noiseConfig.amount || 0) * 100).toFixed(0)}%).`
                    : "Root nodes (no parents) are varied uniformly within their ranges."}
                  {Object.values(interventions || {}).some(Boolean) && " Active do() interventions are respected."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

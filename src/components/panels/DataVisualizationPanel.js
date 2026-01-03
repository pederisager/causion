import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SCATTER_SAMPLE_INTERVAL_MS } from "../constants.js";
import {
  buildLinearLine,
  buildLoessLine,
  computeResidualizedSamples,
} from "../../utils/regressionUtils.js";

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
  const span = max - min;
  const pad = span * 0.1;
  return [min - pad, max + pad];
}

function ScatterPlot({ samples, xLabel, yLabel, themePreset, linePoints }) {
  const width = 260;
  const height = 200;
  const margin = { top: 16, right: 16, bottom: 36, left: 44 };
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
  const domainX = normalizeDomain([
    xs.length ? Math.min(...xs) : -1,
    xs.length ? Math.max(...xs) : 1,
  ]);
  const domainY = normalizeDomain([
    ys.length ? Math.min(...ys) : -1,
    ys.length ? Math.max(...ys) : 1,
  ]);

  const scaleX = (value) => {
    const [min, max] = domainX;
    if (max === min) return margin.left + innerWidth / 2;
    return (
      margin.left +
      ((value - min) / (max - min)) * innerWidth
    );
  };

  const scaleY = (value) => {
    const [min, max] = domainY;
    if (max === min) return margin.top + innerHeight / 2;
    return (
      margin.top +
      (1 - (value - min) / (max - min)) * innerHeight
    );
  };

  const linePath = linePoints && linePoints.length > 1
    ? linePoints
        .map((point) => `${scaleX(point.x)},${scaleY(point.y)}`)
        .join(" ")
    : null;

  return React.createElement(
    "div",
    { className: "w-full" },
      React.createElement(
        "svg",
        {
          role: "img",
          "aria-label": samples.length
            ? `Scatterplot of ${xLabel} versus ${yLabel}`
            : "Empty scatterplot",
          width,
          height,
          className: isCausion ? "rounded border" : "rounded border bg-white",
          style: isCausion
            ? {
                backgroundColor: "var(--color-bg-panel)",
                borderColor: "var(--color-ink-border)",
              }
            : undefined,
        },
      React.createElement("rect", {
        x: margin.left,
        y: margin.top,
        width: innerWidth,
        height: innerHeight,
        fill: panelFill,
      }),
      React.createElement("line", {
        x1: margin.left,
        y1: margin.top + innerHeight,
        x2: margin.left + innerWidth,
        y2: margin.top + innerHeight,
        stroke: axisColor,
        strokeWidth: 1,
      }),
      React.createElement("line", {
        x1: margin.left,
        y1: margin.top,
        x2: margin.left,
        y2: margin.top + innerHeight,
        stroke: axisColor,
        strokeWidth: 1,
      }),
      linePath
        ? React.createElement("polyline", {
            points: linePath,
            fill: "none",
            stroke: lineStroke,
            strokeWidth: 2,
          })
        : null,
      samples.map((sample) =>
        React.createElement("circle", {
          key: sample.id ?? sample.timestamp,
          cx: scaleX(sample.x),
          cy: scaleY(sample.y),
          r: 4,
          fill: pointFill,
          stroke: pointStroke,
          strokeWidth: 1,
        })
      ),
      React.createElement(
        "text",
        {
          x: margin.left + innerWidth / 2,
          y: height - 8,
          textAnchor: "middle",
          fill: axisColor,
          style: isCausion
            ? { fontFamily: "var(--font-body)", fontSize: "0.7rem", letterSpacing: "0.08em" }
            : undefined,
        },
        xLabel || "Select X variable"
      ),
      React.createElement(
        "text",
        {
          x: 12,
          y: margin.top + innerHeight / 2,
          textAnchor: "middle",
          transform: `rotate(-90 12 ${margin.top + innerHeight / 2})`,
          fill: axisColor,
          style: isCausion
            ? { fontFamily: "var(--font-body)", fontSize: "0.7rem", letterSpacing: "0.08em" }
            : undefined,
        },
        yLabel || "Select Y variable"
      )
    ),
    !samples.length
      ? React.createElement(
          "p",
          { className: "mt-2 text-xs text-slate-500" },
          "No points yet. Adjust variables or wait for changes."
        )
      : null
  );
}

export default function DataVisualizationPanel({
  allVars,
  values,
  themePreset,
  isPhoneLayout = false,
  orientation = "portrait",
  controlledVars = [],
  onControlledVarsChange = () => {},
}) {
  const resolvedTheme = detectThemePreset(themePreset);
  const isCausion = resolvedTheme === "causion";
  const joinClasses = (...classes) => classes.filter(Boolean).join(" ");
  const options = useMemo(() => {
    return Array.from(allVars || []).sort();
  }, [allVars]);

  const [{ x, y }, setAxes] = useState(() => getDefaultAxes(options));
  const [isActive, setIsActive] = useState(false);
  const [samples, setSamples] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(!isPhoneLayout);
  const [isControlMenuOpen, setIsControlMenuOpen] = useState(false);
  const [fitMode, setFitMode] = useState("none");

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
    setIsDrawerOpen(!isPhoneLayout);
  }, [isPhoneLayout]);

  useEffect(() => {
    if (isPhoneLayout && isActive) {
      setIsDrawerOpen(true);
    }
  }, [isActive, isPhoneLayout]);

  useEffect(() => {
    if (!isActive) {
      setIsControlMenuOpen(false);
    }
  }, [isActive]);

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
    if (
      x &&
      y &&
      (x !== lastAxes.x || y !== lastAxes.y)
    ) {
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
    if (!isActive || !hasVariables || !x || !y) {
      return undefined;
    }

    const tick = () => {
      const latestValues = valuesRef.current || {};
      const controlKeys = controlsRef.current || [];
      const trackedKeys = Array.from(
        new Set([x, y, ...controlKeys].filter(Boolean))
      );
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

    intervalRef.current = setInterval(
      tick,
      SCATTER_SAMPLE_INTERVAL_MS
    );
    tick();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, x, y, hasVariables]);

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

  const controlOptions = useMemo(() => options, [options]);

  const adjustedResult = useMemo(() => {
    if (!x || !y) return { points: [], status: "invalid" };
    return computeResidualizedSamples(samples, x, y, controlledVars);
  }, [samples, x, y, controlledVars]);

  const adjustedSamples = useMemo(() => {
    return adjustedResult.points.filter(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
    );
  }, [adjustedResult.points]);

  const regressionLine = useMemo(() => {
    if (fitMode === "linear") {
      return buildLinearLine(adjustedSamples);
    }
    if (fitMode === "loess") {
      return buildLoessLine(adjustedSamples);
    }
    return null;
  }, [adjustedSamples, fitMode]);

  const visualizeBtnClass = joinClasses(
    isCausion
      ? isActive
        ? "btn-primary text-sm"
        : "btn-outline text-sm"
      : "px-3 py-1 text-sm font-medium rounded border",
    !hasVariables && !isCausion && "opacity-50 cursor-not-allowed"
  );

  const clearBtnClass = joinClasses(
    isCausion ? "btn-outline text-xs" : "px-2 py-1 text-xs rounded border border-slate-300",
    samples.length === 0 && !isCausion && "opacity-50 cursor-not-allowed"
  );

  const helperTextStyle = isCausion
    ? { color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }
    : undefined;

  const hasControls = controlledVars.length > 0;
  const controlCountLabel = hasControls ? `${controlledVars.length} selected` : "None selected";
  const needsControlAdjustment =
    hasControls && adjustedResult.status !== "adjusted";
  const adjustmentMessage = needsControlAdjustment
    ? adjustedResult.status === "insufficient"
      ? "Add more samples to adjust for controls."
      : adjustedResult.status === "singular"
      ? "Control adjustment failed (controls are collinear)."
      : "Control adjustment unavailable for current inputs."
    : null;

  const panelBody = React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "div",
      { className: "flex items-center justify-between gap-2" },
      React.createElement(
        "button",
        {
          type: "button",
          className: visualizeBtnClass,
          onClick: () => setIsActive((prev) => !prev),
          "aria-pressed": isActive,
          disabled: !hasVariables,
        },
        "Visualize data"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          className: clearBtnClass,
          onClick: handleClear,
          disabled: samples.length === 0,
        },
        "Clear"
      )
    ),
    isActive
      ? hasVariables
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "div",
              { className: "flex items-center gap-2 text-xs" },
              React.createElement(
                "label",
                { className: "flex flex-col gap-1 flex-1" },
                "X axis",
                React.createElement(
                  "select",
                  {
                    value: x,
                    onChange: handleAxisChange("x"),
                    className: isCausion ? "causion-field text-sm" : "border rounded px-2 py-1 text-sm",
                  },
                  options.map((option) =>
                    React.createElement(
                      "option",
                      { key: option, value: option },
                      option
                    )
                  )
                )
              ),
              React.createElement(
                "label",
                { className: "flex flex-col gap-1 flex-1" },
                "Y axis",
                React.createElement(
                  "select",
                  {
                    value: y,
                    onChange: handleAxisChange("y"),
                    className: isCausion ? "causion-field text-sm" : "border rounded px-2 py-1 text-sm",
                  },
                  options.map((option) =>
                    React.createElement(
                      "option",
                      { key: option, value: option },
                      option
                    )
                  )
                )
              )
            ),
            React.createElement(
              "div",
              { className: "mt-2" },
              React.createElement(
                "p",
                {
                  className: joinClasses("text-[0.7rem] uppercase tracking-[0.28em]", isCausion ? "" : "text-slate-500"),
                  style: helperTextStyle,
                },
                "Control for variables"
              ),
              controlOptions.length
                ? React.createElement(
                    "div",
                    {
                      ref: controlMenuRef,
                      className: "relative mt-2",
                    },
                    React.createElement(
                      "button",
                      {
                        type: "button",
                        onClick: () => setIsControlMenuOpen((prev) => !prev),
                        "aria-expanded": isControlMenuOpen,
                        "aria-haspopup": "listbox",
                        className: joinClasses(
                          "w-full flex items-center justify-between gap-2 text-xs px-2 py-1 rounded border",
                          isCausion
                            ? "border-[var(--color-ink-border)] text-[var(--color-text)]"
                            : "border-slate-300 text-slate-700"
                        ),
                      },
                      React.createElement(
                        "span",
                        null,
                        controlCountLabel
                      ),
                      React.createElement(
                        "span",
                        {
                          "aria-hidden": true,
                          className: joinClasses(
                            "text-[0.6rem] uppercase tracking-[0.2em]",
                            isCausion ? "text-[var(--color-text-muted)]" : "text-slate-500"
                          ),
                        },
                        isControlMenuOpen ? "Close" : "Select"
                      )
                    ),
                    isControlMenuOpen
                      ? React.createElement(
                          "div",
                          {
                            role: "listbox",
                            "aria-label": "Control variables",
                            className: joinClasses(
                              "absolute z-20 mt-2 w-full max-h-40 overflow-auto rounded border p-2 text-xs shadow-lg",
                              isCausion
                                ? "bg-[var(--color-bg-panel)] border-[var(--color-ink-border)]"
                                : "bg-white border-slate-200"
                            ),
                          },
                          controlOptions.map((option) =>
                            React.createElement(
                              "label",
                              {
                                key: option,
                                className: "flex items-center gap-2 py-1",
                              },
                              React.createElement("input", {
                                type: "checkbox",
                                checked: controlledVars.includes(option),
                                onChange: handleControlToggle(option),
                                className: isCausion ? "accent-[var(--color-ink-line)]" : "accent-slate-800",
                              }),
                              option
                            )
                          )
                        )
                      : null
                  )
                : React.createElement(
                    "p",
                    {
                      className: joinClasses("mt-2 text-xs", isCausion ? "" : "text-slate-500"),
                      style: helperTextStyle,
                    },
                    "No additional variables available to control for."
                  )
            ),
            React.createElement(
              "label",
              { className: "mt-2 flex flex-col gap-1 text-xs" },
              "Regression line",
              React.createElement(
                "select",
                {
                  value: fitMode,
                  onChange: handleFitModeChange,
                  className: isCausion ? "causion-field text-sm" : "border rounded px-2 py-1 text-sm",
                },
                React.createElement("option", { value: "none" }, "Off"),
                React.createElement("option", { value: "linear" }, "Linear"),
                React.createElement("option", { value: "loess" }, "Loess")
              )
            ),
            React.createElement(
              "p",
              {
                className: joinClasses("text-xs", isCausion ? "" : "text-slate-500"),
                style: helperTextStyle,
              },
              "Points update when either tracked variable changes."
            ),
            adjustmentMessage
              ? React.createElement(
                  "p",
                  {
                    className: joinClasses("text-xs", isCausion ? "" : "text-amber-700"),
                    style: helperTextStyle,
                  },
                  adjustmentMessage
                )
              : null,
            React.createElement(ScatterPlot, {
              samples: adjustedSamples,
              xLabel: x,
              yLabel: y,
              themePreset: resolvedTheme,
              linePoints: regressionLine,
            })
          )
        : React.createElement(
            "p",
            {
              className: joinClasses("text-xs", isCausion ? "" : "text-slate-500"),
              style: helperTextStyle,
            },
            "No variables available to visualize."
          )
      : React.createElement(
          "p",
          {
            className: joinClasses("text-xs", isCausion ? "" : "text-slate-500"),
            style: helperTextStyle,
          },
          "Turn on visualization to log paired values over time."
        )
  );

  if (!isPhoneLayout) {
    return React.createElement(
      "div",
      {
        className: joinClasses(
          "absolute bottom-4 right-4 w-[280px] flex flex-col gap-3",
          isCausion
            ? "causion-panel causion-overlay p-4"
            : "bg-white/95 backdrop-blur rounded-xl shadow-lg border border-slate-200 p-4"
        ),
      },
      panelBody
    );
  }

  return React.createElement(
    "div",
    {
      className: joinClasses(
        "phone-data-viz",
        orientation === "landscape" && "phone-data-viz--landscape",
        isDrawerOpen && "is-open"
      ),
    },
    isDrawerOpen
      ? React.createElement(
          "div",
          {
            className: joinClasses(
              "phone-data-viz__card",
              isCausion
                ? "causion-panel p-4"
                : "bg-white shadow-lg border border-slate-200 rounded-2xl p-4"
            ),
          },
          panelBody,
          React.createElement(
            "button",
            {
              type: "button",
              className: joinClasses(
                "mt-3 text-xs uppercase tracking-[0.2em]",
                isCausion ? "text-[var(--color-text)]" : "text-slate-600"
              ),
              onClick: () => setIsDrawerOpen(false),
            },
            "Close"
          )
        )
      : null,
    React.createElement(
      "div",
      {
        className: joinClasses(
          "phone-data-viz__pill",
          isActive && "is-active",
          isCausion
            ? "causion-panel"
            : "bg-white shadow border border-slate-200"
        ),
      },
      React.createElement(
        "button",
        {
          type: "button",
          className: "pill-action",
          onClick: () => setIsActive((prev) => !prev),
          "aria-pressed": isActive,
        },
        isActive ? "Stop" : "Visualize"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          className: "pill-action pill-action--secondary",
          onClick: () => setIsDrawerOpen((prev) => !prev),
          "aria-expanded": isDrawerOpen,
        },
        isDrawerOpen ? "Hide" : "Details"
      )
    )
  );
}

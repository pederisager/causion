import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SAMPLE_INTERVAL_MS = 750;

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

function ScatterPlot({ samples, xLabel, yLabel }) {
  const width = 260;
  const height = 200;
  const margin = { top: 16, right: 16, bottom: 36, left: 44 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

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
        className: "rounded border bg-white",
      },
      React.createElement("rect", {
        x: margin.left,
        y: margin.top,
        width: innerWidth,
        height: innerHeight,
        fill: "rgba(15, 118, 110, 0.05)",
      }),
      React.createElement("line", {
        x1: margin.left,
        y1: margin.top + innerHeight,
        x2: margin.left + innerWidth,
        y2: margin.top + innerHeight,
        stroke: "#0f172a",
        strokeWidth: 1,
      }),
      React.createElement("line", {
        x1: margin.left,
        y1: margin.top,
        x2: margin.left,
        y2: margin.top + innerHeight,
        stroke: "#0f172a",
        strokeWidth: 1,
      }),
      samples.map((sample) =>
        React.createElement("circle", {
          key: sample.id ?? sample.timestamp,
          cx: scaleX(sample.x),
          cy: scaleY(sample.y),
          r: 4,
          fill: "#0ea5e9",
          stroke: "white",
          strokeWidth: 1,
        })
      ),
      React.createElement(
        "text",
        {
          x: margin.left + innerWidth / 2,
          y: height - 8,
          textAnchor: "middle",
          className: "text-xs fill-slate-600",
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
          className: "text-xs fill-slate-600",
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

export default function DataVisualizationPanel({ allVars, values }) {
  const options = useMemo(() => {
    return Array.from(allVars || []).sort();
  }, [allVars]);

  const [{ x, y }, setAxes] = useState(() => getDefaultAxes(options));
  const [isActive, setIsActive] = useState(false);
  const [samples, setSamples] = useState([]);

  const intervalRef = useRef(null);
  const lastAxesRef = useRef({ x: "", y: "" });
  const valuesRef = useRef(values);
  const hasVariables = options.length > 0;

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

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
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!isActive || !hasVariables || !x || !y) {
      return undefined;
    }

    const tick = () => {
      const latestValues = valuesRef.current || {};
      const xVal = latestValues?.[x];
      const yVal = latestValues?.[y];
      if (!Number.isFinite(Number(xVal)) || !Number.isFinite(Number(yVal))) {
        return;
      }
      const numericX = Number(xVal);
      const numericY = Number(yVal);
      setSamples((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.x === numericX && last.y === numericY) {
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
            x: numericX,
            y: numericY,
            timestamp,
            id,
          },
        ];
      });
    };

    intervalRef.current = setInterval(tick, SAMPLE_INTERVAL_MS);
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

  return React.createElement(
    "div",
    {
      className:
        "absolute bottom-4 right-4 w-[280px] bg-white/95 backdrop-blur rounded-xl shadow-lg border border-slate-200 p-4 flex flex-col gap-3",
    },
    React.createElement(
      "div",
      { className: "flex items-center justify-between gap-2" },
      React.createElement(
        "button",
        {
          type: "button",
          className:
            "px-3 py-1 text-sm font-medium rounded border " +
            (isActive ? "bg-emerald-500 text-white border-emerald-600" : "border-slate-300"),
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
          className: "px-2 py-1 text-xs rounded border border-slate-300",
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
                    className: "border rounded px-2 py-1 text-sm",
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
                    className: "border rounded px-2 py-1 text-sm",
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
              "p",
              { className: "text-xs text-slate-500" },
              "Points update when either tracked variable changes."
            ),
            React.createElement(ScatterPlot, {
              samples,
              xLabel: x,
              yLabel: y,
            })
          )
        : React.createElement(
            "p",
            { className: "text-xs text-slate-500" },
            "No variables available to visualize."
          )
      : React.createElement(
          "p",
          { className: "text-xs text-slate-500" },
          "Turn on visualization to log paired values over time."
        )
  );
}

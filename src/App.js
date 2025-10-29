import React, { useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import CircleNode from "./components/nodes/CircleNode.js";
import CausalEdge from "./components/edges/CausalEdge.js";
import DevPanel from "./components/panels/DevPanel.js";
import DataVisualizationPanel from "./components/panels/DataVisualizationPanel.js";
import { DEFAULT_FEATURE_FLAGS } from "./components/constants.js";
import { PRESETS } from "./data/presets.js";
import { useScmModel } from "./hooks/useScmModel.js";
import { useNodeGraph } from "./hooks/useNodeGraph.js";
import { usePropagationEffects } from "./hooks/usePropagationEffects.js";

const defaultFeatures = { ...DEFAULT_FEATURE_FLAGS };

const nodeTypes = { circle: CircleNode };
const edgeTypes = { causal: CausalEdge };

const defaultFlowBridge = {
  ReactFlowProvider,
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
};

export function createApp(overrides = {}) {
  const bridge = { ...defaultFlowBridge, ...overrides };
  const {
    ReactFlowProvider: FlowProvider,
    ReactFlow: FlowComponent,
    Background: FlowBackground,
    Controls: FlowControls,
    MiniMap: FlowMiniMap,
    useReactFlow: useFlowHook,
  } = bridge;

  function CoreApp() {
    const h = React.createElement;
    const reactFlow = useFlowHook();
    const [features, setFeatures] = useState(defaultFeatures);
    const [isDevPanelVisible, setIsDevPanelVisible] = useState(false);
    const joinClasses = (...classes) => classes.filter(Boolean).join(" ");
    const themePreset = features.stylePreset === "minimal" ? "minimal" : "causion";
    const isCausion = themePreset === "causion";

    useEffect(() => {
      if (typeof document === "undefined") return undefined;
      const body = document.body;
      if (!body) return undefined;
      body.classList.remove("theme-causion", "theme-minimal");
      body.classList.add(isCausion ? "theme-causion" : "theme-minimal");
      return () => {
        body.classList.remove("theme-causion", "theme-minimal");
      };
    }, [isCausion]);

    const defaultPreset = PRESETS[0]?.text ?? "";
    const { scmText, setScmText, error, model, eqs, allVars, graphSignature } = useScmModel(defaultPreset);

    const propagation = usePropagationEffects({
      model,
      eqs,
      allVars,
      features,
    });

    const { nodes, edges, onNodesChange, onEdgesChange } = useNodeGraph({
      eqs,
      allVars,
      features,
      displayValues: propagation.displayValues,
      ranges: propagation.ranges,
      edgeHot: propagation.edgeHot,
      graphSignature,
      reactFlow,
    });
    useEffect(() => {
      if (!reactFlow) return undefined;
      if (!nodes.length) return undefined;
      let timer;
      const frame = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          try {
            reactFlow.fitView({ padding: 0.18, duration: 450 });
          } catch (error) {
            console.warn('fitView failed', error);
          }
        }, 60);
      });
      return () => {
        cancelAnimationFrame(frame);
        if (timer) clearTimeout(timer);
      };
    }, [reactFlow, graphSignature, nodes.length, features.layoutFreeform, features.stylePreset]);
    const startDrag = (id) => {
      if (features.ephemeralClamp) propagation.handleDragStart(id);
    };

    const finishDrag = (id, rawValue) => {
      if (features.ephemeralClamp) propagation.handleDragEnd(id);
      propagation.handleValueCommit(id, rawValue);
    };

    const sliderRows = [...allVars].sort().map((id) => {
      const range = propagation.ranges[id] || { min: -100, max: 100 };
      const sliderValue = propagation.values[id] ?? 0;
      const span = range.max - range.min || 1;
      const normalized = Math.min(
        1,
        Math.max(0, (Number(sliderValue) - range.min) / span)
      );
      const rangeTrackStyle = isCausion
        ? {
            background: `linear-gradient(to right, var(--active) 0%, var(--active) ${normalized *
              100}%, var(--track) ${normalized * 100}%, var(--track) 100%)`,
          }
        : undefined;

      const autoClass = joinClasses(
        isCausion ? "btn-outline text-xs px-2 py-1" : "px-2 py-0.5 rounded border",
        propagation.autoPlay[id] &&
          (isCausion ? "is-active" : "bg-green-50 border-green-400")
      );
      const randomClass = joinClasses(
        isCausion ? "btn-outline text-xs px-2 py-1 is-random" : "px-2 py-0.5 rounded border",
        propagation.randomPlay[id] &&
          (isCausion ? "is-active" : "bg-blue-50 border-blue-400")
      );
      const numberFieldClass = joinClasses(
        isCausion ? "causion-field text-sm" : "w-28 border rounded px-2 py-1"
      );
      const rangeFieldClass = joinClasses(
        isCausion ? "causion-field text-sm" : "w-20 border rounded px-2 py-1"
      );

      const toggleChildren = [
        h(
          "button",
          {
            key: "slide",
            className: autoClass,
            title: "Toggle slide (triangle wave)",
            onClick: () => propagation.toggleAutoPlay(id),
          },
          propagation.autoPlay[id] ? "⏸ slide" : "▶ slide"
        ),
      ];

      if (!isCausion) {
        toggleChildren.push(h("span", { key: "sep-1" }, "|"));
      }

      toggleChildren.push(
        h(
          "button",
          {
            key: "random",
            className: randomClass,
            title: "Toggle random (uniform draw)",
            onClick: () => propagation.toggleRandomPlay(id),
          },
          propagation.randomPlay[id] ? "⏸ random" : "🎲 random"
        )
      );

      if (!isCausion) {
        toggleChildren.push(h("span", { key: "sep-2" }, "|"));
      }

      toggleChildren.push(
        h(
          "label",
          {
            key: "clamp",
            className: joinClasses(
              "flex items-center gap-1",
              isCausion ? "uppercase tracking-[0.12em]" : "text-xs"
            ),
            style: isCausion
              ? { fontFamily: 'var(--font-mono)', fontSize: "0.7rem" }
              : undefined,
          },
          h("input", {
            type: "checkbox",
            className: joinClasses("mr-1", isCausion && "causion-checkbox"),
            checked: !!propagation.interventions[id],
            disabled: !!propagation.autoPlay[id],
            onChange: (e) => propagation.setClamp(id, e.target.checked),
          }),
          "do()"
        )
      );

      const rowProps = { key: id, className: "mb-4" };
      if (isCausion) {
        rowProps["data-causion-slider"] = "";
      }

      return h(
        "div",
        rowProps,
        h(
          "div",
          {
            className: joinClasses(
              "flex items-center gap-3",
              isCausion ? "justify-between text-sm font-medium" : "text-sm font-medium mb-1"
            ),
          },
          h(
            "span",
            { className: "flex items-baseline gap-2" },
            h(
              "span",
              {
                className: isCausion
                  ? "uppercase tracking-[0.12em] text-xs"
                  : undefined,
              },
              `${id}:`
            ),
            h(
              "span",
              {
                className: joinClasses(
                  "opacity-70",
                  isCausion && "text-xs tracking-[0.1em]"
                ),
                style: isCausion
                  ? { fontFamily: 'var(--font-mono)', color: "var(--color-text-muted)" }
                  : undefined,
              },
              Number(sliderValue).toFixed(2)
            )
          ),
          h(
            "div",
            {
              className: joinClasses(
                "ml-auto text-xs flex items-center gap-2",
                isCausion && "ml-0 gap-3"
              ),
            },
            ...toggleChildren
          )
        ),
        h("input", {
          type: "range",
          min: range.min,
          max: range.max,
          step: 1,
          value: sliderValue,
          className: joinClasses("w-full", isCausion && "causion-slider__range"),
          style: rangeTrackStyle,
          onChange: (e) => propagation.handleValueChange(id, Number(e.target.value)),
          onMouseDown: () => startDrag(id),
          onMouseUp: (e) => finishDrag(id, Number(e.currentTarget.value)),
          onMouseLeave: (e) => finishDrag(id, Number(e.currentTarget.value)),
          onTouchStart: () => startDrag(id),
          onTouchEnd: (e) => finishDrag(id, Number(e.target.value)),
          onBlur: (e) => finishDrag(id, Number(e.target.value)),
        }),
        isCausion ? h("div", { className: "ticks" }) : null,
        h(
          "div",
          {
            className: joinClasses(
              "flex gap-2 mt-1 items-center",
              isCausion && "mt-0 text-xs"
            ),
            style: isCausion ? { color: "var(--color-text-muted)" } : undefined,
          },
          h("input", {
            type: "number",
            className: numberFieldClass,
            style: isCausion ? { width: "6.5rem" } : { width: "7rem" },
            min: range.min,
            max: range.max,
            step: 1,
            value: sliderValue,
            onChange: (e) => propagation.handleValueChange(id, Number(e.target.value)),
          }),
          h(
            "span",
            {
              className: joinClasses(
                "text-xs ml-2 opacity-70",
                isCausion && "ml-0 uppercase tracking-[0.2em]"
              ),
            },
            "range"
          ),
          h("input", {
            type: "number",
            className: rangeFieldClass,
            style: isCausion ? { width: "5rem" } : { width: "5.5rem" },
            value: range.min,
            onChange: (e) => propagation.handleRangeMinChange(id, Number(e.target.value)),
          }),
          h("span", null, "→"),
          h("input", {
            type: "number",
            className: rangeFieldClass,
            style: isCausion ? { width: "5rem" } : { width: "5.5rem" },
            value: range.max,
            onChange: (e) => propagation.handleRangeMaxChange(id, Number(e.target.value)),
          })
        )
      );
    });

    const panelBaseClass = joinClasses(
      "w-full flex flex-col gap-4",
      isCausion ? "causion-panel p-5" : "rounded-2xl shadow p-4 border bg-white"
    );
    const panelHeadingClass = isCausion ? "h-heading text-lg" : "text-lg font-bold";

    const presetButtons = PRESETS.map((preset) => {
      const isCurrent = scmText === preset.text;
      return h(
        "button",
        {
          key: preset.key,
          className: joinClasses(
            isCausion ? "btn-outline text-sm" : "px-3 py-1 rounded-lg border",
            isCausion && isCurrent && "is-active"
          ),
          onClick: () => setScmText(preset.text),
        },
        preset.label
      );
    });

    const scmPanel = h(
      "div",
      { className: panelBaseClass },
      h(
        "div",
        {
          className: joinClasses(
            panelHeadingClass,
            isCausion ? "tracking-[0.08em]" : "mb-2"
          ),
        },
        "SCM"
      ),
      h(
        "div",
        {
          className: joinClasses(
            "flex gap-2 flex-wrap",
            isCausion ? "mt-1" : "mb-2"
          ),
        },
        presetButtons
      ),
      h("textarea", {
        className: joinClasses(
          "w-full h-48",
          isCausion ? "causion-field resize-none text-sm leading-6" : "p-2 rounded-xl border"
        ),
        value: scmText,
        onChange: (e) => setScmText(e.target.value),
      }),
      h(
        "div",
        {
          className: joinClasses(
            "text-xs",
            isCausion ? "" : "text-gray-600 mt-2"
          ),
          style: isCausion
            ? { color: "var(--color-text-muted)" }
            : undefined,
        },
        "Use JavaScript-style expressions (nonlinear, trig, logical). Example: ",
        h("code", null, "Med = 0.5 * A + sin(Z)"),
        ". Arrows follow RHS → LHS automatically; helpers: abs/sin/cos/log/exp plus PI & E."
      ),
      error
        ? h(
            "div",
            {
              className: joinClasses(
                "mt-2 text-sm",
                isCausion ? "" : "text-red-700"
              ),
              style: isCausion ? { color: "var(--color-error)" } : undefined,
            },
            error
          )
        : null
    );

    const assignPanel = h(
      "div",
      { className: panelBaseClass },
      h(
        "div",
        {
          className: joinClasses(
            panelHeadingClass,
            isCausion ? "tracking-[0.08em]" : "mb-2"
          ),
        },
        "Assign Values"
      ),
      ...sliderRows
    );

    const leftColumn = h(
      "div",
      {
        className: joinClasses(
          "flex flex-col w-full shrink-0 overflow-y-auto pr-1",
          isCausion ? "gap-5 max-w-md" : "gap-4 max-w-sm"
        ),
      },
      assignPanel,
      scmPanel,
      isDevPanelVisible
        ? h(DevPanel, {
            features,
            setFeatures,
            selectOptions: {
              stylePreset: [
                { value: "causion", label: "Causion" },
                { value: "minimal", label: "Minimal" },
              ],
            },
            themePreset,
          })
        : null
    );

    const flowChildren = [
      h(FlowBackground, {
        key: "bg",
        variant: isCausion ? "lines" : "dots",
        gap: isCausion ? 32 : 16,
        color: isCausion ? "rgba(226, 222, 206, 0.35)" : "#e2e8f0",
      }),
      h(FlowMiniMap, {
        key: "mm",
        pannable: true,
        zoomable: true,
        maskColor: isCausion ? "rgba(251, 249, 244, 0.9)" : undefined,
        nodeColor: isCausion ? "var(--color-ink-line)" : undefined,
      }),
      h(FlowControls, {
        key: "controls",
        style: isCausion ? { color: "var(--color-text-muted)" } : undefined,
      }),
    ];

    const canvasWrapperClass = joinClasses(
      "relative overflow-hidden flex-1 w-full rounded-2xl shadow border h-[80vh]",
      isCausion && "causion-canvas"
    );
    const canvasWrapperStyle = undefined;

    const rightColumn = h(
      "div",
      { className: "flex-1 min-h-0" },
      h(
        "style",
        null,
        "@keyframes antsForward { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -24; } }"
      ),
      h(
        "div",
        { className: canvasWrapperClass, style: canvasWrapperStyle },
        h(
          FlowComponent,
          {
            nodes,
            edges,
            nodeTypes,
            edgeTypes,
            onNodesChange,
            onEdgesChange,
            style: { width: "100%", height: "100%" },
          },
          flowChildren
        ),
        h(DataVisualizationPanel, {
          allVars,
          values: propagation.values,
          themePreset,
        })
      )
    );

    const devToggleButton = h(
      "button",
      {
        type: "button",
        className: joinClasses(
          isCausion ? "btn-outline text-sm" : "px-3 py-1 rounded border shadow-sm text-sm",
          isCausion && isDevPanelVisible && "is-active"
        ),
        onClick: () => setIsDevPanelVisible((previous) => !previous),
        "aria-expanded": isDevPanelVisible,
      },
      isDevPanelVisible ? "Hide dev panel" : "Show dev panel"
    );

    return h(
      "div",
      {
        className: joinClasses(
          "w-full h-full flex flex-col gap-4 p-4",
          isCausion && "causion-app"
        ),
      },
      h(
        "div",
        {
          className: joinClasses(
            "flex items-center justify-between gap-4",
            isCausion && "pb-2 border-b"
          ),
          style: isCausion ? { borderColor: "var(--color-ink-border)" } : undefined,
        },
        h(
          "h1",
          {
            className: isCausion ? "h-heading text-3xl" : "text-3xl font-extrabold",
          },
          "Causion – simulate causality"
        ),
        devToggleButton
      ),
      h(
        "div",
        {
          className: joinClasses(
            "flex flex-1 gap-4 overflow-hidden",
            isCausion && "gap-6"
          ),
        },
        leftColumn,
        rightColumn
      )
    );
  }

  function AppWrapper() {
    return React.createElement(FlowProvider, null, React.createElement(CoreApp));
  }

  return { App: AppWrapper, CoreApp };
}

const { App: GeneratedApp } = createApp();

export default GeneratedApp;
export const __TEST_ONLY__ = { createApp };

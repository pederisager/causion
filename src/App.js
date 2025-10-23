import React, { useState } from "react";
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
      return h(
        "div",
        { key: id, className: "mb-4" },
        h(
          "div",
          { className: "text-sm font-medium mb-1 flex items-center gap-3" },
          h(
            "span",
            null,
            id,
            ": ",
            h("span", { className: "opacity-70" }, Number(sliderValue).toFixed(2))
          ),
          h(
            "label",
            { className: "ml-auto text-xs flex items-center gap-2" },
          h(
            "button",
            {
              className:
                "px-2 py-0.5 rounded border " + (propagation.autoPlay[id] ? "bg-green-50 border-green-400" : ""),
              title: "Toggle slide (triangle wave)",
              onClick: () => propagation.toggleAutoPlay(id),
            },
            propagation.autoPlay[id] ? "⏸ slide" : "▶ slide"
          ),
          h("span", null, "|"),
          h(
            "button",
            {
              className:
                "px-2 py-0.5 rounded border " +
                (propagation.randomPlay[id] ? "bg-blue-50 border-blue-400" : ""),
              title: "Toggle random (uniform draw)",
              onClick: () => propagation.toggleRandomPlay(id),
            },
            propagation.randomPlay[id] ? "⏸ random" : "🎲 random"
          ),
          h("span", null, "|"),
          h("input", {
            type: "checkbox",
            className: "mr-1",
            checked: !!propagation.interventions[id],
            disabled: !!propagation.autoPlay[id],
            "aria-label": "Toggle do()",
            onChange: (e) => propagation.setClamp(id, e.target.checked),
          }),
          "do()"
          )
        ),
        h("input", {
          type: "range",
          min: range.min,
          max: range.max,
          step: 1,
          value: sliderValue,
          onChange: (e) => propagation.handleValueChange(id, Number(e.target.value)),
          onMouseDown: () => startDrag(id),
          onMouseUp: (e) => finishDrag(id, Number(e.currentTarget.value)),
          onMouseLeave: (e) => finishDrag(id, Number(e.currentTarget.value)),
          onTouchStart: () => startDrag(id),
          onTouchEnd: (e) => finishDrag(id, Number(e.target.value)),
          onBlur: (e) => finishDrag(id, Number(e.target.value)),
        }),
        h(
          "div",
          { className: "flex gap-2 mt-1 items-center" },
          h("input", {
            type: "number",
            className: "w-28 border rounded px-2 py-1",
            min: range.min,
            max: range.max,
            step: 1,
            value: sliderValue,
            onChange: (e) => propagation.handleValueChange(id, Number(e.target.value)),
          }),
          h("span", { className: "text-xs ml-2 opacity-70" }, "range:"),
          h("input", {
            type: "number",
            className: "w-20 border rounded px-2 py-1",
            value: range.min,
            onChange: (e) => propagation.handleRangeMinChange(id, Number(e.target.value)),
          }),
          h("span", null, "→"),
          h("input", {
            type: "number",
            className: "w-20 border rounded px-2 py-1",
            value: range.max,
            onChange: (e) => propagation.handleRangeMaxChange(id, Number(e.target.value)),
          })
        )
      );
    });

    const presetButtons = PRESETS.map((preset) =>
      h(
        "button",
        {
          key: preset.key,
          className: "px-3 py-1 rounded-lg border",
          onClick: () => setScmText(preset.text),
        },
        preset.label
      )
    );

    const scmPanel = h(
      "div",
      { className: "rounded-2xl shadow p-4 border w-full" },
      h("div", { className: "text-lg font-bold mb-2" }, "SCM"),
      h("div", { className: "flex gap-2 mb-2" }, presetButtons),
      h("textarea", {
        className: "w-full h-48 p-2 rounded-xl border",
        value: scmText,
        onChange: (e) => setScmText(e.target.value),
      }),
      h(
        "div",
        { className: "text-xs text-gray-600 mt-2" },
        "Linear only. Example: ",
        h("code", null, "Med = 0.5*A"),
        ". Arrows point from RHS vars to LHS var."
      ),
      error ? h("div", { className: "mt-2 text-sm text-red-700" }, error) : null
    );

    const assignPanel = h(
      "div",
      { className: "rounded-2xl shadow p-4 border w-full" },
      h("div", { className: "text-lg font-bold mb-2" }, "Assign Values (intervene)"),
      sliderRows
    );

    const leftColumn = h(
      "div",
      {
        className: "flex flex-col gap-4 w-full max-w-sm shrink-0 overflow-y-auto pr-1",
      },
      assignPanel,
      scmPanel,
      isDevPanelVisible ? h(DevPanel, { features, setFeatures }) : null
    );

    const flowChildren = [
      h(FlowBackground, { key: "bg" }),
      h(FlowMiniMap, { pannable: true, zoomable: true, key: "mm" }),
      h(FlowControls, { key: "controls" }),
    ];

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
        { className: "relative rounded-2xl shadow border h-[80vh] overflow-hidden" },
        h(
          FlowComponent,
          {
            nodes,
            edges,
            nodeTypes,
            edgeTypes,
            onNodesChange,
            onEdgesChange,
          },
          flowChildren
        ),
        h(DataVisualizationPanel, {
          allVars,
          values: propagation.values,
        })
      )
    );

    const devToggleButton = h(
      "button",
      {
        type: "button",
        className: "px-3 py-1 rounded border shadow-sm text-sm",
        onClick: () => setIsDevPanelVisible((previous) => !previous),
        "aria-expanded": isDevPanelVisible,
      },
      isDevPanelVisible ? "Hide dev panel" : "Show dev panel"
    );

    return h(
      "div",
      {
        className: "w-full h-full flex flex-col gap-4 p-4",
        style: { fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system" },
      },
      h(
        "div",
        { className: "flex items-center justify-between gap-4" },
        h("h1", { className: "text-3xl font-extrabold" }, "Interactive DAG"),
        devToggleButton
      ),
      h(
        "div",
        { className: "flex flex-1 gap-4 overflow-hidden" },
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

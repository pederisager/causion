import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import CircleNode from "./components/nodes/CircleNode.js";
import CausalEdge from "./components/edges/CausalEdge.js";
import DataVisualizationPanel from "./components/panels/DataVisualizationPanel.js";
import { DEFAULT_FEATURE_FLAGS } from "./components/constants.js";
import { PRESETS } from "./data/presets.js";
import { useScmModel } from "./hooks/useScmModel.js";
import { useNodeGraph } from "./hooks/useNodeGraph.js";
import { usePropagationEffects } from "./hooks/usePropagationEffects.js";
import { usePhoneLayout } from "./hooks/usePhoneLayout.js";

const DevPanel = lazy(() => import("./components/panels/DevPanel.js"));
const CheatSheetModal = lazy(() => import("./components/panels/CheatSheetModal.jsx"));

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

const SCM_CHEATSHEET_URL = "/scm-function-cheatsheet.html";

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
    const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);
    const [forcePhoneLayout, setForcePhoneLayout] = useState(false);
    const [advancedOpenMap, setAdvancedOpenMap] = useState({});
    const { isPhoneLayout, orientation } = usePhoneLayout(forcePhoneLayout);
    const isPortrait = orientation !== "landscape";
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

    useEffect(() => {
      if (typeof document === "undefined") return undefined;
      const body = document.body;
      if (!body) return undefined;
      if (isPhoneLayout) {
        body.classList.add("phone-ui-mode");
      } else {
        body.classList.remove("phone-ui-mode");
      }
      return () => {
        body.classList.remove("phone-ui-mode");
      };
    }, [isPhoneLayout]);

    const defaultPreset = PRESETS[0]?.text ?? "";
    const {
      scmText,
      setScmText,
      applyScmChanges,
      hasPendingChanges,
      error,
      model,
      eqs,
      allVars,
      graphSignature,
    } = useScmModel(defaultPreset);

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
      model,
      displayValues: propagation.displayValues,
      ranges: propagation.ranges,
      interventions: propagation.interventions,
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

    const sortedVariables = useMemo(() => Array.from(allVars || []).sort(), [allVars]);

    const sliderRows = sortedVariables.map((id) => {
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
      const numberFieldClass = joinClasses(
        isCausion ? "causion-field text-sm" : "w-28 border rounded px-2 py-1"
      );
      const rangeFieldClass = joinClasses(
        isCausion ? "causion-field text-sm" : "w-20 border rounded px-2 py-1"
      );
      const isAuto = !!propagation.autoPlay[id];
      const isRandom = !!propagation.randomPlay[id];
      const isClamped = !!propagation.interventions[id];
      const isAdvancedOpen = !!advancedOpenMap[id];
      const slideAriaLabel = isAuto
        ? `Stop auto slide for ${id}`
        : `Start auto slide for ${id}`;
      const randomAriaLabel = isRandom
        ? `Stop random play for ${id}`
        : `Start random play for ${id}`;
      const doAriaLabel = isClamped
        ? `Release do() clamp for ${id}`
        : `Apply do() clamp for ${id}`;
      const advancedAriaLabel = isAdvancedOpen
        ? `Hide advanced controls for ${id}`
        : `Show advanced controls for ${id}`;
      const iconButtonBase = joinClasses(
        "w-9 h-9 rounded-full border flex items-center justify-center text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        isCausion
          ? "border-[var(--color-ink-border)] text-[var(--color-text)] focus-visible:ring-[var(--color-ink-border)]"
          : "border-slate-300 text-slate-700 bg-white shadow-sm focus-visible:ring-slate-400"
      );
      const slideBtnClass = joinClasses(
        iconButtonBase,
        isAuto &&
          (isCausion
            ? "bg-[var(--color-node-pos)] text-white border-[var(--color-node-pos)]"
            : "bg-amber-500 text-white border-amber-500")
      );
      const randomBtnClass = joinClasses(
        iconButtonBase,
        isRandom &&
          (isCausion
            ? "bg-[var(--color-node-neg)] text-white border-[var(--color-node-neg)]"
            : "bg-slate-800 text-white border-slate-800")
      );
      const doButtonClass = joinClasses(
        "px-3 py-1 rounded-full text-[0.7rem] font-semibold tracking-[0.18em] uppercase border transition",
        isCausion
          ? "border-[var(--color-ink-border)]"
          : "border-slate-300 text-slate-700",
        isClamped &&
          (isCausion
            ? "bg-[var(--color-ink-line)] text-white border-[var(--color-ink-line)]"
            : "bg-slate-900 text-white border-slate-900"),
        isAuto && "opacity-50 cursor-not-allowed"
      );
      const advancedToggleClass = joinClasses(
        iconButtonBase,
        "text-lg",
        isAdvancedOpen &&
          (isCausion
            ? "bg-[var(--color-bg-panel)]"
            : "bg-slate-100")
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
              isPhoneLayout ? "phone-slider__header" : "",
              isCausion ? "text-sm font-medium" : "text-sm font-medium mb-1"
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
                  : "text-xs font-semibold",
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
            { className: "flex items-center gap-2 ml-auto" },
            h(
              "button",
              {
                type: "button",
                className: slideBtnClass,
            title: "Toggle slide (triangle wave)",
            "aria-label": slideAriaLabel,
            onClick: () => propagation.toggleAutoPlay(id),
            "aria-pressed": isAuto,
          },
          isAuto ? "⏸" : "▶"
        ),
            h(
              "button",
              {
                type: "button",
                className: randomBtnClass,
            title: "Toggle random (uniform draw)",
            "aria-label": randomAriaLabel,
            onClick: () => propagation.toggleRandomPlay(id),
            "aria-pressed": isRandom,
          },
          "🎲"
        ),
            h(
              "button",
              {
                type: "button",
            className: doButtonClass,
            disabled: isAuto,
            onClick: () => {
              if (isAuto) return;
              propagation.setClamp(id, !isClamped);
            },
            "aria-pressed": isClamped,
            "aria-label": doAriaLabel,
          },
          "DO"
        ),
            h(
              "button",
              {
                type: "button",
                className: advancedToggleClass,
            title: "Adjust precise value and range",
            "aria-label": advancedAriaLabel,
            onClick: () =>
              setAdvancedOpenMap((prev) => ({
                ...prev,
                    [id]: !prev[id],
                  })),
                "aria-expanded": isAdvancedOpen,
              },
              "⋯"
            )
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
        isAdvancedOpen
          ? h(
              "div",
              {
                className: joinClasses(
                  "flex flex-col gap-2 mt-2 text-xs",
                  isCausion && "text-[0.7rem] tracking-[0.08em]"
                ),
                style: isCausion ? { color: "var(--color-text-muted)" } : undefined,
              },
              h(
                "label",
                { className: "flex flex-col gap-1" },
                "Value",
                h("input", {
                  type: "number",
                  className: numberFieldClass,
                  style: isCausion ? { width: "100%" } : undefined,
                  min: range.min,
                  max: range.max,
                  step: 1,
                  value: sliderValue,
                  onChange: (e) => propagation.handleValueChange(id, Number(e.target.value)),
                })
              ),
              h(
                "div",
                { className: "flex items-center gap-2" },
                h(
                  "label",
                  { className: "flex flex-col gap-1 flex-1" },
                  "Min",
                  h("input", {
                    type: "number",
                    className: rangeFieldClass,
                    value: range.min,
                    onChange: (e) => propagation.handleRangeMinChange(id, Number(e.target.value)),
                  })
                ),
                h(
                  "label",
                  { className: "flex flex-col gap-1 flex-1" },
                  "Max",
                  h("input", {
                    type: "number",
                    className: rangeFieldClass,
                    value: range.max,
                    onChange: (e) => propagation.handleRangeMaxChange(id, Number(e.target.value)),
                  })
                )
              )
            )
          : null
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

    const renderApplyButton = (variant = "panel") =>
      h(
        "button",
        {
          type: "button",
          className: joinClasses(
            "px-4 py-2 rounded-md font-semibold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 transition-colors",
            isCausion ? "uppercase tracking-[0.12em]" : "",
            hasPendingChanges ? "" : "opacity-60 cursor-not-allowed",
            variant === "dock" && "w-full flex items-center justify-center text-base"
          ),
          style: isCausion
            ? {
                background: hasPendingChanges
                  ? "linear-gradient(135deg, #f8d77b 10%, #d8a632 55%, #b8860b 100%)"
                  : "#d1c49a",
                color: "#1f1402",
                border: "1px solid rgba(138, 101, 9, 0.8)",
                boxShadow: hasPendingChanges
                  ? "0 2px 6px rgba(68, 48, 4, 0.25)"
                  : "none",
              }
            : {
                backgroundColor: hasPendingChanges ? "#d4a017" : "#c9b27a",
                color: "#1f1402",
                border: "1px solid rgba(138, 101, 9, 0.6)",
              },
          disabled: !hasPendingChanges,
          onClick: () => {
            if (!hasPendingChanges) return;
            applyScmChanges();
          },
        },
        "Apply changes"
      );

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
      !isPhoneLayout
        ? h(
            "div",
            {
              className: joinClasses(
                "mt-3 flex items-center gap-3",
                isCausion ? "justify-start" : ""
              ),
            },
            renderApplyButton()
          )
        : null,
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
        h(
          "p",
          null,
          "Write one equation per line using the format ",
          h("code", null, "Variable = expression"),
          ". Each variable name on the left creates a child node and every identifier on the right creates a parent."
        ),
        h(
          "p",
          { className: "mt-1" },
          "Expressions support basic math (+ − × ÷), exponentiation with ",
          h("code", null, "^"),
          ", parentheses, and conditional logic. Built-in helpers include ",
          h("code", null, "abs"),
          ", ",
          h("code", null, "sin"),
          ", ",
          h("code", null, "cos"),
          ", ",
          h("code", null, "log"),
          ", ",
          h("code", null, "exp"),
          ", plus constants ",
          h("code", null, "PI"),
          " and ",
          h("code", null, "E.")
        ),
        h(
          "p",
          { className: "mt-1" },
          "Need a gentle walkthrough? ",
          h(
            "button",
            {
              type: "button",
              className: joinClasses(
                "cheatsheet-trigger",
                isCausion ? "cheatsheet-trigger--causion" : "cheatsheet-trigger--minimal"
              ),
              onClick: () => setIsCheatSheetOpen(true),
            },
            "Open the cheat sheet"
          ),
          " for beginner-friendly patterns and common recipes."
        )
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

    const desktopUtilityButtonClass = joinClasses(
      isCausion ? "btn-outline text-sm" : "px-3 py-1 rounded border shadow-sm text-sm"
    );
    const condensedUtilityButtonClass = joinClasses(
      isCausion
        ? "btn-outline text-[0.65rem] tracking-[0.15em] w-full flex items-center justify-center"
        : "px-2 py-1 rounded border shadow-sm text-xs w-full flex items-center justify-center"
    );

    const renderEdgeLabelToggleButton = (variant = "desktop") =>
      h(
        "button",
        {
          type: "button",
          className: joinClasses(
            variant === "desktop" ? desktopUtilityButtonClass : condensedUtilityButtonClass,
            isCausion && features.edgeEffectLabels && "is-active"
          ),
          onClick: () =>
            setFeatures((previous) => ({
              ...previous,
              edgeEffectLabels: !previous.edgeEffectLabels,
            })),
          "aria-pressed": features.edgeEffectLabels,
        },
        features.edgeEffectLabels ? "Hide edge formulas" : "Show edge formulas"
      );

    const renderDevToggleButton = (variant = "desktop") =>
      h(
        "button",
        {
          type: "button",
          className: joinClasses(
            variant === "desktop" ? desktopUtilityButtonClass : condensedUtilityButtonClass,
            isCausion && isDevPanelVisible && "is-active"
          ),
          onClick: () => setIsDevPanelVisible((previous) => !previous),
          "aria-expanded": isDevPanelVisible,
        },
        isDevPanelVisible ? "Hide dev panel" : "Show dev panel"
      );

    const renderPhonePreviewButton = (variant = "desktop") =>
      h(
        "button",
        {
          type: "button",
          className: joinClasses(
            variant === "desktop" ? desktopUtilityButtonClass : condensedUtilityButtonClass,
            forcePhoneLayout && (isCausion ? "is-active" : "bg-amber-100")
          ),
          onClick: () => setForcePhoneLayout((prev) => !prev),
          "aria-pressed": forcePhoneLayout,
        },
        forcePhoneLayout ? "Exit phone UI beta" : "Phone UI beta"
      );

    const phoneUtilityPanel = isPhoneLayout
      ? h(
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
            "Tools"
          ),
          h(
            "div",
            { className: "grid grid-cols-2 gap-2 w-full" },
            renderEdgeLabelToggleButton("condensed"),
            renderDevToggleButton("condensed"),
            renderPhonePreviewButton("condensed")
          )
        )
      : null;

    const dockedApply = isPhoneLayout
      ? h(
          "div",
          {
            className: "phone-apply-dock",
          },
          h(
            "div",
            {
              className: joinClasses(
                "phone-apply-dock__inner",
                isCausion ? "causion-panel" : "rounded-2xl shadow border bg-white"
              ),
            },
            renderApplyButton("dock")
          )
        )
      : null;

    const devPanelContent = isDevPanelVisible
      ? h(
          Suspense,
          {
            fallback: h(
              "div",
              { className: panelBaseClass },
              "Loading dev panel…"
            ),
          },
          h(DevPanel, {
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
        )
      : null;

    const leftColumn = h(
      "div",
      {
        className: joinClasses(
          "panel-zone flex flex-col w-full shrink-0",
          isCausion ? "gap-5 max-w-md" : "gap-4 max-w-sm",
          isPhoneLayout
            ? "panel-zone--phone phone-pane phone-pane--panels"
            : "overflow-y-auto pr-1"
        ),
      },
      assignPanel,
      scmPanel,
      phoneUtilityPanel,
      devPanelContent,
      dockedApply
    );

    const flowChildren = [
      h(FlowBackground, {
        key: "bg",
        variant: isCausion ? "lines" : "dots",
        gap: isCausion ? 32 : 16,
        color: isCausion ? "rgba(226, 222, 206, 0.35)" : "#e2e8f0",
      }),
      !isPhoneLayout
        ? h(FlowMiniMap, {
            key: "mm",
            pannable: true,
            zoomable: true,
            maskColor: isCausion ? "rgba(251, 249, 244, 0.9)" : undefined,
            nodeColor: isCausion ? "var(--color-ink-line)" : undefined,
          })
        : null,
      h(FlowControls, {
        key: "controls",
        position: isPhoneLayout ? "top-right" : "bottom-left",
        style: isCausion
          ? { color: "var(--color-text-muted)" }
          : undefined,
      }),
    ].filter(Boolean);

    const canvasWrapperClass = joinClasses(
      "relative overflow-hidden flex-1 w-full rounded-2xl shadow border",
      isPhoneLayout ? "phone-dag-canvas" : "h-[80vh]",
      isCausion && "causion-canvas"
    );
    const canvasWrapperStyle = undefined;

    const rightColumn = h(
      "section",
      {
        className: joinClasses(
          "dag-zone flex-1 min-h-0",
          isPhoneLayout && "dag-zone--phone phone-pane phone-pane--dag",
          !isPhoneLayout && "pl-1"
        ),
      },
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
            deleteKeyCode: null,
            style: { width: "100%", height: "100%" },
          },
          flowChildren
        ),
        h(DataVisualizationPanel, {
          allVars,
          values: propagation.values,
          themePreset,
          isPhoneLayout,
          orientation,
        })
      )
    );

    const layoutClass = joinClasses(
      "flex flex-1 gap-4 min-h-0",
      isCausion && "gap-6",
      isPhoneLayout ? "phone-layout overflow-y-auto" : "overflow-hidden",
      isPhoneLayout && (isPortrait ? "phone-layout--portrait" : "phone-layout--landscape")
    );
    const layoutChildren = isPhoneLayout && isPortrait
      ? [rightColumn, leftColumn]
      : [leftColumn, rightColumn];

    return h(
      "div",
      {
        className: joinClasses(
          "w-full h-full flex flex-col gap-4 p-4 min-h-0",
          isCausion && "causion-app",
          isPhoneLayout && "phone-ui-shell"
        ),
      },
      h(
        "div",
        {
          className: joinClasses(
            "flex items-center justify-between gap-3",
            isCausion && "pb-2 border-b",
            isPhoneLayout && "phone-header"
          ),
          style: isCausion ? { borderColor: "var(--color-ink-border)" } : undefined,
        },
        h(
          "h1",
          {
            className: joinClasses(
              isPhoneLayout
                ? "text-sm font-semibold uppercase tracking-[0.35em]"
                : isCausion
                  ? "h-heading text-3xl"
                  : "text-3xl font-extrabold"
            ),
          },
          isPhoneLayout ? "Causion" : "Causion – simulate causality"
        ),
        !isPhoneLayout
          ? h(
              "div",
              { className: "flex items-center gap-2 flex-wrap justify-end" },
              renderEdgeLabelToggleButton(),
              renderDevToggleButton(),
              renderPhonePreviewButton()
            )
          : null
      ),
      h(
        "div",
        { className: layoutClass },
        ...layoutChildren
      ),
      isCheatSheetOpen
        ? h(
            Suspense,
            { fallback: null },
            h(CheatSheetModal, {
              isOpen: isCheatSheetOpen,
              onClose: () => setIsCheatSheetOpen(false),
              cheatSheetUrl: SCM_CHEATSHEET_URL,
            })
          )
        : null
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

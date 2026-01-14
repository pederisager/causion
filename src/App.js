import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  NodeToolbar,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import CircleNode from "./components/nodes/CircleNode.js";
import NoiseNode from "./components/nodes/NoiseNode.js";
import CausalEdge from "./components/edges/CausalEdge.js";
import DataVizPanel from "./components/DataVizPanel.jsx";
import DockLayout from "./components/layout/DockLayout.jsx";
import NodeQuickMenu from "./components/NodeQuickMenu.jsx";
import NodeNamePrompt from "./components/NodeNamePrompt.jsx";
import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_NOISE_SCALE,
  NODE_WIDTH,
  NOISE_SCALE_MAX,
  NOISE_SCALE_STEP,
} from "./components/constants.js";
import { PRESETS } from "./data/presets.js";
import { useScmModel } from "./hooks/useScmModel.js";
import { useNodeGraph } from "./hooks/useNodeGraph.js";
import { usePropagationEffects } from "./hooks/usePropagationEffects.js";
import { usePhoneLayout } from "./hooks/usePhoneLayout.js";
import { useMediaQuery } from "./hooks/useMediaQuery.js";
import { usePanelPrefs } from "./hooks/usePanelPrefs.js";
import {
  addNodeToScm,
  isValidScmName,
  removeEdgeFromScm,
  removeNodeFromScm,
  renameNodeInScm,
  upsertEdgeCoefficient,
} from "./graph/scmMutations.js";
import { topoSort } from "./graph/topology.js";
import { buildGraphSignature } from "./utils/graphSignature.js";
import { buildNoiseAugmentedGraph } from "./utils/noiseUtils.js";

const DevPanel = lazy(() => import("./components/panels/DevPanel.js"));
const CheatSheetModal = lazy(() => import("./components/panels/CheatSheetModal.jsx"));

const defaultFeatures = { ...DEFAULT_FEATURE_FLAGS };

const nodeTypes = { circle: CircleNode, noise: NoiseNode };
const edgeTypes = { causal: CausalEdge };

const defaultFlowBridge = {
  ReactFlowProvider,
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  NodeToolbar,
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
    NodeToolbar: FlowNodeToolbar,
    useReactFlow: useFlowHook,
  } = bridge;

  function CoreApp() {
    const h = React.createElement;
    const reactFlow = useFlowHook();
    const [features, setFeatures] = useState(defaultFeatures);
    const [noiseEnabled, setNoiseEnabled] = useState(false);
    const [noiseAmount, setNoiseAmount] = useState(DEFAULT_NOISE_SCALE);
    const [isAdvancedPanelVisible, setIsAdvancedPanelVisible] = useState(false);
    const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);
    const [forcePhoneLayout, setForcePhoneLayout] = useState(false);
    const [advancedOpenMap, setAdvancedOpenMap] = useState({});
    const [controlledVars, setControlledVars] = useState([]);
    const [activeNodeId, setActiveNodeId] = useState(null);
    const [nodePrompt, setNodePrompt] = useState(null);
    const [editingNodeId, setEditingNodeId] = useState(null);
    const [editingNodeDraft, setEditingNodeDraft] = useState("");
    const [nodeNameDraft, setNodeNameDraft] = useState("");
    const [nodeNameError, setNodeNameError] = useState("");
    const [dagNotice, setDagNotice] = useState("");
    const [positionOverrides, setPositionOverrides] = useState({});
    const [layoutLock, setLayoutLock] = useState(false);
    const dagNoticeTimerRef = useRef(null);
    const canvasWrapperRef = useRef(null);
    const dataPanelRef = useRef(null);
    const dataPanelHeadingRef = useRef(null);
    const dataPanelTriggerRef = useRef(null);
    const dataPanelWasOpenRef = useRef(false);
    const sliderDragIntentRef = useRef({});
    const { isPhoneLayout, orientation, width: viewportWidth, height: viewportHeight } =
      usePhoneLayout(forcePhoneLayout);
    const [dataPanelPrefs, setDataPanelPrefs] = usePanelPrefs();
    const isLgViewport = useMediaQuery("(min-width: 1024px)");
    const isMdViewport = useMediaQuery("(min-width: 768px)");
    const isPortrait = orientation !== "landscape";
    const joinClasses = (...classes) => classes.filter(Boolean).join(" ");
    const themePreset = features.stylePreset === "minimal" ? "minimal" : "causion";
    const isCausion = themePreset === "causion";
    const dataPanelDockMode = isPhoneLayout
      ? "bottom"
      : !isMdViewport
      ? "overlay"
      : isLgViewport
      ? dataPanelPrefs.dockPreference
      : "bottom";
    const dataPanelSizePx =
      dataPanelDockMode === "right" ? dataPanelPrefs.sizeRightPx : dataPanelPrefs.sizeBottomPx;
    const dataPanelSizeMin = 240;
    const dataPanelSizeMax =
      dataPanelDockMode === "right"
        ? Math.max(320, Math.min(720, Math.floor((viewportWidth || 1200) * 0.6)))
        : Math.max(240, Math.min(640, Math.floor((viewportHeight || 900) * 0.6)));
    const connectionRadius = Math.round(NODE_WIDTH / 2 + 8);

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
      commitScmText,
      hasPendingChanges,
      error,
      model,
      eqs,
      allVars,
      appliedScmText,
    } = useScmModel(defaultPreset);

    const noiseConfig = useMemo(
      () => ({ enabled: noiseEnabled, amount: noiseAmount }),
      [noiseEnabled, noiseAmount]
    );

    const { eqs: graphEqs, allVars: graphAllVars, noiseNodes } = useMemo(() => {
      if (!noiseEnabled) {
        return { eqs, allVars, noiseNodes: new Set() };
      }
      return buildNoiseAugmentedGraph(eqs, allVars);
    }, [eqs, allVars, noiseEnabled]);

    const graphSignature = useMemo(() => buildGraphSignature(graphEqs), [graphEqs]);

    const showDagNotice = useCallback((message) => {
      if (dagNoticeTimerRef.current) {
        clearTimeout(dagNoticeTimerRef.current);
      }
      setDagNotice(message);
      if (message) {
        dagNoticeTimerRef.current = setTimeout(() => {
          setDagNotice("");
        }, 2400);
      }
    }, []);

    const handleApplyChanges = useCallback(() => {
      if (!hasPendingChanges) return { ok: false, error: "" };
      const result = applyScmChanges();
      if (result.ok) {
        setLayoutLock(false);
        setPositionOverrides({});
      }
      return result;
    }, [applyScmChanges, hasPendingChanges]);

    useEffect(() => {
      return () => {
        if (dagNoticeTimerRef.current) {
          clearTimeout(dagNoticeTimerRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (!hasPendingChanges) {
        setDagNotice("");
      }
    }, [hasPendingChanges]);

    const guardDagEdits = useCallback(() => {
      if (!hasPendingChanges) return true;
      showDagNotice("Apply SCM changes before editing the DAG.");
      return false;
    }, [hasPendingChanges, showDagNotice]);

    const propagation = usePropagationEffects({
      model,
      eqs: graphEqs,
      allVars: graphAllVars,
      features,
      noiseConfig,
    });

    const commitDagScmText = useCallback((nextText) => {
      setLayoutLock(true);
      const result = commitScmText(nextText);
      if (!result.ok) {
        showDagNotice(result.error || "Failed to update SCM.");
      }
      return result;
    }, [commitScmText, showDagNotice]);

    const handleEdgeCoefficientCommit = useCallback(
      (edgeId, coefficient) => {
        if (!guardDagEdits()) return;
        const [parent, child] = String(edgeId || "").split("->");
        if (!parent || !child) {
          showDagNotice("Invalid edge.");
          return;
        }
        try {
          const nextText = upsertEdgeCoefficient(
            appliedScmText,
            parent,
            child,
            coefficient,
            { requireExistingTerm: true }
          );
          commitDagScmText(nextText);
        } catch (err) {
          showDagNotice(err?.message || "Unable to update edge.");
        }
      },
      [appliedScmText, commitDagScmText, guardDagEdits, showDagNotice, upsertEdgeCoefficient]
    );

    const isAssignmentsPaused = propagation.isAssignmentsPaused;

    const { nodes, edges, onNodesChange, onEdgesChange } = useNodeGraph({
      eqs: graphEqs,
      allVars: graphAllVars,
      noiseNodes,
      features,
      model,
      displayValues: propagation.displayValues,
      ranges: propagation.ranges,
      interventions: propagation.interventions,
      controlledVars,
      edgeHot: propagation.edgeHot,
      graphSignature,
      reactFlow,
      onEdgeCoefficientCommit: handleEdgeCoefficientCommit,
      positionOverrides,
      layoutLock,
    });
    const handleNodesChange = useCallback(
      (changes) => {
        if (Array.isArray(changes) && changes.some((change) => change.type === "position")) {
          setLayoutLock(true);
        }
        onNodesChange(changes);
      },
      [onNodesChange]
    );

    const cancelNodeRename = useCallback(() => {
      setEditingNodeId(null);
      setEditingNodeDraft("");
    }, []);

    const handleNodeNameEdit = useCallback(
      (_event, nodeId) => {
        if (!guardDagEdits()) return;
        if (!nodeId) return;
        if (activeNodeId !== nodeId) {
          setActiveNodeId(nodeId);
          return;
        }
        setEditingNodeId(nodeId);
        setEditingNodeDraft(nodeId);
        setNodePrompt(null);
        setNodeNameDraft("");
        setNodeNameError("");
      },
      [activeNodeId, guardDagEdits]
    );

    const handleRenameCommit = useCallback(
      ({ exitOnError = false } = {}) => {
        if (!editingNodeId) return;
        if (!guardDagEdits()) {
          if (exitOnError) cancelNodeRename();
          return;
        }
        const trimmed = String(editingNodeDraft || "").trim();
        if (!trimmed) {
          showDagNotice("Name is required.");
          if (exitOnError) cancelNodeRename();
          return;
        }
        if (!isValidScmName(trimmed)) {
          showDagNotice("Use letters, numbers, or underscores only.");
          if (exitOnError) cancelNodeRename();
          return;
        }
        if (trimmed === editingNodeId) {
          cancelNodeRename();
          return;
        }
        if (allVars?.has(trimmed)) {
          showDagNotice("That name already exists.");
          if (exitOnError) cancelNodeRename();
          return;
        }
        try {
          const currentPos = nodes.find((node) => node.id === editingNodeId)?.position;
          if (currentPos) {
            setLayoutLock(true);
            setPositionOverrides((prev) => ({ ...prev, [trimmed]: currentPos }));
          }
          const nextText = renameNodeInScm(appliedScmText, editingNodeId, trimmed);
          const result = commitDagScmText(nextText);
          if (result.ok) {
            setActiveNodeId(trimmed);
            setControlledVars((prev) =>
              prev.includes(editingNodeId)
                ? prev.map((name) => (name === editingNodeId ? trimmed : name))
                : prev
            );
            cancelNodeRename();
          }
        } catch (err) {
          showDagNotice(err?.message || "Unable to rename node.");
          if (exitOnError) cancelNodeRename();
        }
      },
      [
        allVars,
        appliedScmText,
        cancelNodeRename,
        commitDagScmText,
        editingNodeDraft,
        editingNodeId,
        features.layoutFreeform,
        guardDagEdits,
        isValidScmName,
        nodes,
        renameNodeInScm,
        showDagNotice,
      ]
    );

    const nodesWithNameEdit = useMemo(() => {
      if (!nodes.length) return nodes;
      return nodes.map((node) => {
        const isNoise = noiseNodes?.has(node.id);
        return {
          ...node,
          data: {
            ...(node.data || {}),
            ...(isNoise
              ? { canEditName: false }
              : {
                  onNameEdit: handleNodeNameEdit,
                  onNameDraftChange: setEditingNodeDraft,
                  onNameCommit: handleRenameCommit,
                  onNameCancel: cancelNodeRename,
                  canEditName: true,
                  isEditingName: editingNodeId === node.id,
                  nameDraft: editingNodeId === node.id ? editingNodeDraft : node.id,
                  isNameActive: activeNodeId === node.id,
                }),
          },
        };
      });
    }, [
      activeNodeId,
      cancelNodeRename,
      editingNodeDraft,
      editingNodeId,
      handleNodeNameEdit,
      handleRenameCommit,
      nodes,
      noiseNodes,
    ]);
    useEffect(() => {
      if (!reactFlow) return undefined;
      if (!nodes.length) return undefined;
      if (layoutLock) return undefined;
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
    }, [reactFlow, graphSignature, nodes.length, features.layoutFreeform, features.stylePreset, layoutLock]);

    useEffect(() => {
      if (!allVars || !allVars.size) return;
      setPositionOverrides((prev) => {
        const next = { ...prev };
        let mutated = false;
        for (const id of Object.keys(next)) {
          if (!allVars.has(id)) {
            delete next[id];
            mutated = true;
          }
        }
        return mutated ? next : prev;
      });
    }, [allVars]);
    const startDrag = (id) => {
      sliderDragIntentRef.current[id] = true;
      if (features.ephemeralClamp) propagation.handleDragStart(id);
    };

    const finishDrag = (id, rawValue) => {
      if (!sliderDragIntentRef.current[id]) return;
      sliderDragIntentRef.current[id] = false;
      if (features.ephemeralClamp) propagation.handleDragEnd(id);
      propagation.handleValueCommit(id, rawValue);
    };

    useEffect(() => {
      if (activeNodeId && !allVars?.has(activeNodeId)) {
        setActiveNodeId(null);
      }
    }, [activeNodeId, allVars]);

    useEffect(() => {
      if (editingNodeId && !allVars?.has(editingNodeId)) {
        cancelNodeRename();
      }
    }, [allVars, cancelNodeRename, editingNodeId]);

    const handlePaneDoubleClick = useCallback((event) => {
      if (!guardDagEdits()) return;
      if (!reactFlow || !canvasWrapperRef.current) return;
      const target = event?.target;
      if (target?.closest?.(".react-flow__node") || target?.closest?.(".react-flow__edge")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const rect = canvasWrapperRef.current.getBoundingClientRect();
      const screenPoint = { x: event.clientX, y: event.clientY };
      const flowPoint = reactFlow.screenToFlowPosition(screenPoint);
      setNodePrompt({
        position: {
          x: screenPoint.x - rect.left,
          y: screenPoint.y - rect.top,
        },
        flowPosition: flowPoint,
      });
      cancelNodeRename();
      setNodeNameDraft("");
      setNodeNameError("");
      setActiveNodeId(null);
    }, [cancelNodeRename, guardDagEdits, reactFlow]);

    const handlePaneClick = useCallback((event) => {
      const target = event?.target;
      if (
        target?.closest?.(".react-flow__node") ||
        target?.closest?.(".react-flow__edge") ||
        target?.closest?.(".node-quick-menu") ||
        target?.closest?.(".node-name-prompt")
      ) {
        return;
      }
      setActiveNodeId(null);
      setNodePrompt(null);
      setNodeNameDraft("");
      setNodeNameError("");
    }, []);

    const handleNodePromptCancel = useCallback(() => {
      setActiveNodeId(null);
      setNodePrompt(null);
      setNodeNameDraft("");
      setNodeNameError("");
    }, []);

    useEffect(() => {
      const wrapper = canvasWrapperRef.current;
      if (!wrapper || typeof window === "undefined") return undefined;
      const handler = (event) => {
        if (!wrapper.contains(event.target)) return;
        handlePaneDoubleClick(event);
      };
      window.addEventListener("dblclick", handler, true);
      return () => window.removeEventListener("dblclick", handler, true);
    }, [handlePaneDoubleClick]);

    const handleCreateNode = useCallback(() => {
      if (!guardDagEdits()) return;
      const trimmed = String(nodeNameDraft || "").trim();
      if (!trimmed) {
        setNodeNameError("Name is required.");
        return;
      }
      if (!isValidScmName(trimmed)) {
        setNodeNameError("Use letters, numbers, or underscores only.");
        return;
      }
      if (allVars?.has(trimmed)) {
        setNodeNameError("That name already exists.");
        return;
      }
      try {
        if (nodePrompt?.flowPosition) {
          setLayoutLock(true);
          setPositionOverrides((prev) => ({
            ...prev,
            [trimmed]: nodePrompt.flowPosition,
          }));
        }
        const nextText = addNodeToScm(appliedScmText, trimmed);
        const result = commitDagScmText(nextText);
        if (result.ok) {
          setNodePrompt(null);
          setNodeNameDraft("");
          setNodeNameError("");
        }
      } catch (err) {
        setNodeNameError(err?.message || "Unable to add node.");
      }
    }, [addNodeToScm, allVars, appliedScmText, commitDagScmText, guardDagEdits, isValidScmName, nodeNameDraft, nodePrompt]);

    const handleNodeClick = useCallback(
      (event, node) => {
        event?.stopPropagation?.();
        if (node?.id && noiseNodes?.has(node.id)) {
          return;
        }
        if (editingNodeId && node?.id !== editingNodeId) {
          cancelNodeRename();
        }
        setActiveNodeId(node?.id || null);
        setNodePrompt(null);
        setNodeNameDraft("");
        setNodeNameError("");
      },
      [cancelNodeRename, editingNodeId, noiseNodes]
    );

    const isValidConnection = useCallback((connection) => {
      if (hasPendingChanges) return false;
      if (!connection?.source || !connection?.target) return false;
      if (connection.source === connection.target) return false;
      try {
        const next = new Map();
        for (const [child, parents] of eqs || []) {
          next.set(child, new Set(parents));
        }
        if (!next.has(connection.target)) {
          next.set(connection.target, new Set());
        }
        next.get(connection.target).add(connection.source);
        topoSort(next);
        return true;
      } catch (err) {
        return false;
      }
    }, [eqs, hasPendingChanges]);

    const handleConnect = useCallback((connection) => {
      if (!guardDagEdits()) return;
      if (!connection?.source || !connection?.target) return;
      if (connection.source === connection.target) {
        showDagNotice("Self-links are not allowed.");
        return;
      }
      if (!isValidConnection(connection)) {
        showDagNotice("That edge would create a cycle.");
        return;
      }
      try {
        const nextText = upsertEdgeCoefficient(
          appliedScmText,
          connection.source,
          connection.target,
          1
        );
        commitDagScmText(nextText);
      } catch (err) {
        showDagNotice(err?.message || "Unable to add edge.");
      }
    }, [appliedScmText, commitDagScmText, guardDagEdits, isValidConnection, showDagNotice, upsertEdgeCoefficient]);

    const getSelectedNodeId = useCallback(() => {
      if (activeNodeId) return activeNodeId;
      const selected = nodes.find((node) => node.selected);
      return selected?.id || null;
    }, [activeNodeId, nodes]);

    const getSelectedEdgeId = useCallback(() => {
      const selected = edges.find((edge) => edge.selected);
      return selected?.id || null;
    }, [edges]);

    const handleDeleteSelectedEdge = useCallback(() => {
      const edgeId = getSelectedEdgeId();
      if (!edgeId) return false;
      if (!guardDagEdits()) return true;
      const [parent, child] = String(edgeId || "").split("->");
      if (!parent || !child) {
        showDagNotice("Invalid edge.");
        return true;
      }
      try {
        const nextText = removeEdgeFromScm(appliedScmText, parent, child);
        const result = commitDagScmText(nextText);
        if (!result.ok) {
          showDagNotice(result.error || "Failed to remove edge.");
        }
      } catch (err) {
        showDagNotice(err?.message || "Unable to delete edge.");
      }
      return true;
    }, [appliedScmText, commitDagScmText, getSelectedEdgeId, guardDagEdits, removeEdgeFromScm, showDagNotice]);

    const handleDeleteSelectedNode = useCallback(() => {
      const nodeId = getSelectedNodeId();
      if (!nodeId) return false;
      if (!guardDagEdits()) return true;
      try {
        const nextText = removeNodeFromScm(appliedScmText, nodeId);
        const result = commitDagScmText(nextText);
        if (!result.ok) {
          showDagNotice(result.error || "Failed to remove node.");
          return true;
        }
        setActiveNodeId(null);
        setNodePrompt(null);
        setNodeNameDraft("");
        setNodeNameError("");
        setPositionOverrides((prev) => {
          if (!prev || !Object.prototype.hasOwnProperty.call(prev, nodeId)) return prev;
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
      } catch (err) {
        showDagNotice(err?.message || "Unable to delete node.");
      }
      return true;
    }, [
      appliedScmText,
      commitDagScmText,
      getSelectedNodeId,
      guardDagEdits,
      removeNodeFromScm,
      showDagNotice,
    ]);

    useEffect(() => {
      if (typeof window === "undefined") return undefined;
      const handleKeyDown = (event) => {
        if (event.defaultPrevented) return;
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        const target = event.target;
        if (target && typeof target === "object") {
          const element = target instanceof HTMLElement ? target : null;
          if (element) {
            const tagName = element.tagName;
            if (element.isContentEditable) return;
            if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;
          }
        }
        const handledEdge = handleDeleteSelectedEdge();
        if (handledEdge) {
          event.preventDefault();
          return;
        }
        const handledNode = handleDeleteSelectedNode();
        if (handledNode) {
          event.preventDefault();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleDeleteSelectedEdge, handleDeleteSelectedNode]);

    const sortedVariables = useMemo(
      () => Array.from(allVars || []).filter((id) => !noiseNodes.has(id)).sort(),
      [allVars, noiseNodes]
    );

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

      const rowProps = {
        key: id,
        className: joinClasses("mb-4", isAssignmentsPaused && "opacity-60"),
      };
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
            onClick: () => {
              if (isAssignmentsPaused) return;
              propagation.toggleAutoPlay(id);
            },
            "aria-pressed": isAuto,
            disabled: isAssignmentsPaused,
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
            onClick: () => {
              if (isAssignmentsPaused) return;
              propagation.toggleRandomPlay(id);
            },
            "aria-pressed": isRandom,
            disabled: isAssignmentsPaused,
          },
          "🎲"
        ),
            h(
              "button",
              {
                type: "button",
            className: doButtonClass,
            disabled: isAuto || isAssignmentsPaused,
            onClick: () => {
              if (isAuto || isAssignmentsPaused) return;
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
            onClick: () => {
              if (isAssignmentsPaused) return;
              setAdvancedOpenMap((prev) => ({
                ...prev,
                [id]: !prev[id],
              }));
            },
                "aria-expanded": isAdvancedOpen,
                disabled: isAssignmentsPaused,
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
          disabled: isAssignmentsPaused,
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
                  disabled: isAssignmentsPaused,
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
                    disabled: isAssignmentsPaused,
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
                    disabled: isAssignmentsPaused,
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
            handleApplyChanges();
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

    const pauseAssignmentsLabel = isAssignmentsPaused ? "Resume ▶︎" : "Pause ❚❚";
    const assignmentControlButtonClass = joinClasses(
      isCausion ? "btn-outline text-[0.7rem] tracking-[0.12em]" : "px-2 py-1 rounded border text-xs"
    );
    const pauseButtonClass = joinClasses(
      assignmentControlButtonClass,
      isAssignmentsPaused && (isCausion ? "is-active" : "bg-amber-100")
    );

    const noiseControl = h(
      "div",
      {
        className: joinClasses(
          "flex items-center gap-2 rounded-full border px-3 py-1 flex-[0_1_200px] min-w-[140px]",
          isCausion
            ? "border-[var(--color-ink-border)] bg-[var(--color-bg-panel)]"
            : "border-slate-200 bg-white"
        ),
      },
      h(
        "span",
        {
          className: joinClasses(
            isCausion ? "text-[0.65rem] tracking-[0.14em] uppercase" : "text-xs font-semibold"
          ),
        },
        "Noise"
      ),
      h("input", {
        type: "range",
        min: 0,
        max: NOISE_SCALE_MAX,
        step: NOISE_SCALE_STEP,
        value: noiseAmount,
        className: joinClasses("w-20", isCausion && "causion-slider__range"),
        onChange: (event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          const clamped = Math.max(0, Math.min(NOISE_SCALE_MAX, next));
          setNoiseAmount(clamped);
        },
        disabled: !noiseEnabled,
        "aria-label": "Noise amount",
      }),
      h(
        "label",
        { className: "flex items-center gap-2 cursor-pointer" },
        h(
          "span",
          {
            className: joinClasses(
              isCausion ? "text-[0.6rem] tracking-[0.12em] uppercase" : "text-[0.65rem]"
            ),
          },
          noiseEnabled ? "On" : "Off"
        ),
        h("input", {
          type: "checkbox",
          checked: noiseEnabled,
          onChange: (event) => setNoiseEnabled(event.target.checked),
          "aria-label": "Toggle noise",
          className: isCausion ? "causion-checkbox" : "",
        })
      )
    );

    const assignPanel = h(
      "div",
      { className: panelBaseClass },
      h(
        "div",
        {
          className: joinClasses(
            "flex items-center gap-3 flex-wrap",
            !isCausion && "mb-2"
          ),
        },
        h(
          "div",
          {
            className: joinClasses(
              panelHeadingClass,
              isCausion ? "tracking-[0.08em]" : "",
              "shrink-0"
            ),
          },
          "Assign Values"
        ),
        h(
          "div",
          { className: "flex items-center gap-2 flex-wrap justify-end flex-1 min-w-[200px]" },
          h(
            "button",
            {
              type: "button",
              className: pauseButtonClass,
              onClick: () => propagation.toggleAssignmentsPaused(),
              "aria-pressed": isAssignmentsPaused,
            },
            pauseAssignmentsLabel
          ),
          h(
            "button",
            {
              type: "button",
              className: assignmentControlButtonClass,
              onClick: () => propagation.resetAssignments(),
            },
            "Reset ⟲"
          )
        )
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

    const dataPanelToggleLabel = dataPanelPrefs.isOpen ? "Hide data" : "Visualize data";
    const renderDataPanelToggleButton = (variant = "desktop") =>
      h(
        "button",
        {
          type: "button",
          ref: dataPanelTriggerRef,
          className: joinClasses(
            variant === "desktop" ? desktopUtilityButtonClass : condensedUtilityButtonClass,
            isCausion && dataPanelPrefs.isOpen && "is-active"
          ),
          onClick: () =>
            setDataPanelPrefs((previous) => ({
              ...previous,
              isOpen: !previous.isOpen,
            })),
          "aria-expanded": dataPanelPrefs.isOpen,
          "aria-controls": "data-panel",
        },
        dataPanelToggleLabel
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

    const advancedPanelToggleLabel = isAdvancedPanelVisible
      ? "Hide advanced functions"
      : "Advanced functions";
    const renderAdvancedPanelToggleButton = (variant = "desktop") =>
      h(
        "button",
        {
          type: "button",
          className: joinClasses(
            variant === "desktop" ? desktopUtilityButtonClass : condensedUtilityButtonClass,
            isCausion && isAdvancedPanelVisible && "is-active"
          ),
          onClick: () => setIsAdvancedPanelVisible((previous) => !previous),
          "aria-expanded": isAdvancedPanelVisible,
          "aria-controls": "advanced-panel",
        },
        advancedPanelToggleLabel
      );

    const renderExitPhonePreviewButton = (variant = "desktop") =>
      h(
        "button",
        {
          type: "button",
          className: variant === "desktop" ? desktopUtilityButtonClass : condensedUtilityButtonClass,
          onClick: () => setForcePhoneLayout(false),
        },
        "Exit phone UI beta"
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
            renderDataPanelToggleButton("condensed"),
            renderEdgeLabelToggleButton("condensed")
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

    const devPanelContent = h(
      Suspense,
      {
        fallback: h("div", { className: panelBaseClass }, "Loading dev panel…"),
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
    );

    const leftColumn = isAdvancedPanelVisible
      ? h(
          "div",
          {
            id: "advanced-panel",
            role: "region",
            "aria-label": "Advanced functions",
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
        )
      : null;
    const hasPhonePanels = isPhoneLayout && Boolean(leftColumn);

    const activeNodeRange = activeNodeId
      ? propagation.ranges?.[activeNodeId] || { min: -100, max: 100 }
      : null;
    const activeNodeValue = activeNodeId ? propagation.values?.[activeNodeId] ?? 0 : 0;
    const activeNodeMenu = activeNodeId
      ? h(
          FlowNodeToolbar,
          {
            key: "node-menu",
            nodeId: activeNodeId,
            isVisible: true,
            position: "bottom",
            offset: 18,
          },
          h(NodeQuickMenu, {
            id: activeNodeId,
            value: activeNodeValue,
            range: activeNodeRange,
            isAuto: !!propagation.autoPlay?.[activeNodeId],
            isRandom: !!propagation.randomPlay?.[activeNodeId],
            isClamped: !!propagation.interventions?.[activeNodeId],
            isAssignmentsPaused,
            themePreset,
            onToggleAuto: () => {
              if (isAssignmentsPaused) return;
              propagation.toggleAutoPlay(activeNodeId);
            },
            onToggleRandom: () => {
              if (isAssignmentsPaused) return;
              propagation.toggleRandomPlay(activeNodeId);
            },
            onToggleClamp: () => {
              if (isAssignmentsPaused) return;
              propagation.setClamp(activeNodeId, !propagation.interventions?.[activeNodeId]);
            },
            onValueChange: (nextValue) => propagation.handleValueChange(activeNodeId, nextValue),
            onDragStart: () => startDrag(activeNodeId),
            onDragEnd: (value) => finishDrag(activeNodeId, value),
            onClose: () => setActiveNodeId(null),
          })
        )
      : null;

    const handleDataPanelResize = useCallback(
      (nextSizePx) => {
        const clamped = Math.min(dataPanelSizeMax, Math.max(dataPanelSizeMin, nextSizePx));
        setDataPanelPrefs((previous) => ({
          ...previous,
          [dataPanelDockMode === "right" ? "sizeRightPx" : "sizeBottomPx"]: clamped,
        }));
      },
      [dataPanelDockMode, dataPanelSizeMax, dataPanelSizeMin, setDataPanelPrefs]
    );

    const handleDataPanelClose = useCallback(() => {
      setDataPanelPrefs((previous) => ({ ...previous, isOpen: false }));
    }, [setDataPanelPrefs]);

    const handleDockPreferenceChange = useCallback(
      (nextDock) => {
        setDataPanelPrefs((previous) => ({ ...previous, dockPreference: nextDock }));
      },
      [setDataPanelPrefs]
    );

    useEffect(() => {
      if (typeof document === "undefined") return undefined;
      const isOpen = dataPanelPrefs.isOpen;
      const wasOpen = dataPanelWasOpenRef.current;
      const isOverlay = dataPanelDockMode === "overlay";
      const focusableSelector =
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      let focusTimer;
      let previousOverflow;

      const handleKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          handleDataPanelClose();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = dataPanelRef.current?.querySelectorAll(focusableSelector);
        if (!focusable || focusable.length === 0) return;
        const focusArray = Array.from(focusable);
        const first = focusArray[0];
        const last = focusArray[focusArray.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      if (isOpen) {
        if (isOverlay) {
          previousOverflow = document.body.style.overflow;
          document.body.style.overflow = "hidden";
          window.addEventListener("keydown", handleKeyDown);
        }
        focusTimer = window.requestAnimationFrame(() => {
          if (dataPanelHeadingRef.current) {
            dataPanelHeadingRef.current.focus();
            return;
          }
          const firstFocusable = dataPanelRef.current?.querySelector(focusableSelector);
          if (firstFocusable && firstFocusable.focus) {
            firstFocusable.focus();
          }
        });
      } else if (wasOpen) {
        dataPanelTriggerRef.current?.focus();
      }

      dataPanelWasOpenRef.current = isOpen;

      return () => {
        if (focusTimer) {
          window.cancelAnimationFrame(focusTimer);
        }
        if (isOverlay) {
          window.removeEventListener("keydown", handleKeyDown);
          if (previousOverflow !== undefined) {
            document.body.style.overflow = previousOverflow;
          }
        }
      };
    }, [dataPanelDockMode, dataPanelPrefs.isOpen, handleDataPanelClose]);

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
      activeNodeMenu,
    ].filter(Boolean);

    const canvasWrapperClass = joinClasses(
      "relative overflow-hidden flex-1 w-full rounded-2xl shadow border min-h-0",
      isPhoneLayout ? "phone-dag-canvas" : "",
      isCausion && "causion-canvas"
    );
    const canvasWrapperStyle = undefined;

    const dataVizPanel = h(DataVizPanel, {
      allVars,
      values: propagation.sampleValues,
      themePreset,
      controlledVars,
      interventions: propagation.interventions,
      ranges: propagation.ranges,
      isOpen: dataPanelPrefs.isOpen,
      dockMode: dataPanelDockMode,
      dockPreference: dataPanelPrefs.dockPreference,
      showDockSelector: isLgViewport,
      onDockPreferenceChange: handleDockPreferenceChange,
      onControlledVarsChange: setControlledVars,
      onClose: handleDataPanelClose,
      containerRef: dataPanelRef,
      headingRef: dataPanelHeadingRef,
    });

    const dagCanvas = h(
      "div",
      {
        className: canvasWrapperClass,
        style: canvasWrapperStyle,
        ref: canvasWrapperRef,
        onClickCapture: handlePaneClick,
      },
      h(
        FlowComponent,
        {
          nodes: nodesWithNameEdit,
          edges,
          nodeTypes,
          edgeTypes,
          onNodesChange: handleNodesChange,
          onEdgesChange,
          onNodeClick: handleNodeClick,
          onConnect: handleConnect,
          isValidConnection,
          connectionRadius,
          deleteKeyCode: null,
          style: { width: "100%", height: "100%" },
        },
        flowChildren
      ),
        nodePrompt
          ? h(NodeNamePrompt, {
              position: nodePrompt.position,
              value: nodeNameDraft,
              error: nodeNameError,
              onChange: (value) => {
                setNodeNameDraft(value);
                setNodeNameError("");
              },
              onSubmit: handleCreateNode,
              onCancel: handleNodePromptCancel,
              themePreset,
            })
          : null,
      dagNotice
        ? h(
            "div",
            {
              className: joinClasses(
                "dag-notice",
                isCausion ? "dag-notice--causion" : "dag-notice--minimal"
              ),
            },
            dagNotice
          )
        : null
    );

    const dockedDag = h(DockLayout, {
      primary: dagCanvas,
      secondary: dataVizPanel,
      isOpen: dataPanelPrefs.isOpen,
      dockMode: dataPanelDockMode,
      sizePx: dataPanelSizePx,
      minSize: dataPanelSizeMin,
      maxSize: dataPanelSizeMax,
      onResize: handleDataPanelResize,
      onClose: handleDataPanelClose,
      className: "min-h-0 flex-1",
    });

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
      dockedDag
    );

    const layoutClass = joinClasses(
      "flex flex-1 gap-4 min-h-0",
      isCausion && "gap-6",
      isPhoneLayout ? "phone-layout overflow-y-auto" : "overflow-hidden",
      isPhoneLayout && (isPortrait ? "phone-layout--portrait" : "phone-layout--landscape"),
      hasPhonePanels && "phone-layout--has-panels"
    );
    const layoutChildren = (
      isPhoneLayout && isPortrait ? [rightColumn, leftColumn] : [leftColumn, rightColumn]
    ).filter(Boolean);

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
              noiseControl,
              renderDataPanelToggleButton(),
              renderEdgeLabelToggleButton(),
              renderAdvancedPanelToggleButton()
            )
          : h(
              "div",
              { className: "flex items-center gap-2 flex-wrap justify-end" },
              renderDataPanelToggleButton("condensed"),
              renderAdvancedPanelToggleButton("condensed"),
              forcePhoneLayout ? renderExitPhonePreviewButton("condensed") : null
            )
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeValues, shallowEqualObj } from "../graph/math.js";
import { getNoiseTargetId, isNoiseId, sampleGaussian } from "../utils/noiseUtils.js";
import { scheduleEdgePulse, scheduleNodeDisplayUpdate, clearPendingTimers } from "../utils/timers.js";
import { tri } from "../data/presets.js";
import {
  AUTO_SLIDE_PERIOD_SECONDS,
  RANDOM_UPDATE_INTERVAL_MS,
} from "../components/constants.js";

const DEFAULT_RANGE = { min: -100, max: 100 };

function buildActiveClampMap(
  allVars,
  interventions,
  autoPlay,
  randomPlay,
  dragging,
  features,
  pauseAll = false
) {
  const out = {};
  if (pauseAll) {
    for (const id of allVars) {
      out[id] = true;
    }
    return out;
  }
  const useEphemeral = !!(features && features.ephemeralClamp);
  for (const id of allVars) {
    out[id] =
      !!interventions[id] ||
      !!autoPlay[id] ||
      !!randomPlay[id] ||
      (useEphemeral && !!dragging[id]);
  }
  return out;
}

function clampToRange(value, range) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return range.min;
  return Math.min(range.max, Math.max(range.min, num));
}

function computePropagationPlan(seeds, parentToChildren, lag) {
  const seenDepth = new Map();
  const queue = [];
  const plan = [];

  for (const src of seeds) {
    seenDepth.set(src, 0);
    queue.push({ node: src, depth: 0 });
  }

  while (queue.length) {
    const { node, depth } = queue.shift();
    const children = parentToChildren.get(node);
    if (!children) continue;
    for (const child of children) {
      const nextDepth = depth + 1;
      if (seenDepth.has(child) && seenDepth.get(child) <= nextDepth) continue;
      seenDepth.set(child, nextDepth);
      queue.push({ node: child, depth: nextDepth });
      plan.push({ node: child, parent: node, delay: nextDepth * lag });
    }
  }

  return plan;
}

function createNodeDisplayUpdater(lastValuesRef, nodeId, setDisplayValues) {
  return () => {
    const latestValues = lastValuesRef.current || {};
    const latest = latestValues[nodeId];
    setDisplayValues((prev) => {
      if (prev[nodeId] === latest) return prev;
      return { ...prev, [nodeId]: latest };
    });
  };
}

function collectPropagationSeeds({
  changedIds,
  directChanged,
  interventions,
  autoPlay,
  randomPlay,
  dragging,
  features,
}) {
  if (!Array.isArray(changedIds) || changedIds.length === 0) return [];
  const out = [];
  const useEphemeral = !!(features && features.ephemeralClamp);
  for (const id of changedIds) {
    if (
      directChanged[id] ||
      interventions[id] ||
      autoPlay[id] ||
      randomPlay[id] ||
      (useEphemeral && dragging[id])
    ) {
      out.push(id);
    }
  }
  return out;
}

export function usePropagationEffects({ model, eqs, allVars, features, noiseConfig = {} }) {
  const [values, setValues] = useState({});
  const [displayValues, setDisplayValues] = useState({});
  const [sampleValues, setSampleValues] = useState({});
  const [interventions, setInterventions] = useState({});
  const [ranges, setRanges] = useState({});
  const [autoPlay, setAutoPlay] = useState({});
  const [autoStart, setAutoStart] = useState({});
  const [randomPlay, setRandomPlay] = useState({});
  const [dragging, setDragging] = useState({});
  const [edgeHot, setEdgeHot] = useState({});
  const [isAssignmentsPaused, setIsAssignmentsPaused] = useState(false);
  const [noiseEpoch, setNoiseEpoch] = useState(0);

  const directChangedRef = useRef({});
  const lastValuesRef = useRef({});
  const valuesRef = useRef({});
  const prevDraggingRef = useRef({});
  const pendingTimersRef = useRef([]);
  const nodeUpdateTimersRef = useRef(new Map());
  const edgeTimersRef = useRef(new Map());
  const rafRef = useRef(null);
  const randomTimersRef = useRef(new Map());
  const randomPlayRef = useRef({});
  const autoPlayRef = useRef({});
  const isPausedRef = useRef(false);
  const rangesRef = useRef({});
  const prevAutoPlayRef = useRef({});
  const prevRandomPlayRef = useRef({});
  const prevInterventionsRef = useRef({});
  const noiseValuesRef = useRef({
    enabled: false,
    amount: 0,
    epoch: 0,
    byTarget: {},
    byNode: {},
    nodes: new Set(),
  });
  const noiseConfigRef = useRef(noiseConfig);

  const buildFlagMap = useCallback(
    (source = {}) => {
      const next = {};
      for (const id of allVars) {
        next[id] = !!source[id];
      }
      return next;
    },
    [allVars]
  );

  const buildRangeMap = useCallback(() => {
    const next = {};
    for (const id of allVars) {
      next[id] = { ...DEFAULT_RANGE };
    }
    return next;
  }, [allVars]);

  const buildAutoStartMap = useCallback(
    (source = {}) => {
      const now = performance?.now?.() ?? Date.now();
      const next = {};
      for (const id of allVars) {
        if (source[id]) {
          const range = rangesRef.current?.[id] || DEFAULT_RANGE;
          const span = range.max - range.min || 1;
          const current = Number(lastValuesRef.current?.[id] ?? 0);
          const normalized = (current - range.min) / span;
          const p0 = Math.max(0, Math.min(1, normalized / 2));
          next[id] = { t0: now, p0 };
        } else {
          next[id] = { t0: now, p0: 0 };
        }
      }
      return next;
    },
    [allVars]
  );

  const parentToChildren = useMemo(() => {
    const map = new Map();
    for (const [child, parents] of eqs) {
      for (const parent of parents) {
        if (!map.has(parent)) map.set(parent, new Set());
        map.get(parent).add(child);
      }
    }
    return map;
  }, [eqs]);

  useEffect(() => {
    const ids = [...allVars];
    setValues((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] == null) next[id] = 0;
      });
      for (const key of Object.keys(next)) {
        if (!allVars.has(key)) delete next[key];
      }
      return next;
    });
    setDisplayValues((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] == null) next[id] = 0;
      });
      for (const key of Object.keys(next)) {
        if (!allVars.has(key)) delete next[key];
      }
      return next;
    });
    setInterventions((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] == null) next[id] = false;
      });
      for (const key of Object.keys(next)) {
        if (!allVars.has(key)) delete next[key];
      }
      return next;
    });
    setRanges((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (!next[id]) next[id] = { ...DEFAULT_RANGE };
      });
      for (const key of Object.keys(next)) {
        if (!allVars.has(key)) delete next[key];
      }
      return next;
    });
    const now = performance?.now?.() ?? Date.now();
    setAutoPlay((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] == null) next[id] = false;
      });
      for (const key of Object.keys(next)) {
        if (!allVars.has(key)) delete next[key];
      }
      return next;
    });
    setAutoStart((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (!next[id]) next[id] = { t0: now, p0: 0 };
      });
      for (const key of Object.keys(next)) {
        if (!allVars.has(key)) delete next[key];
      }
      return next;
    });
    setRandomPlay((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] == null) next[id] = false;
      });
      for (const key of Object.keys(next)) {
        if (!allVars.has(key)) delete next[key];
      }
      return next;
    });
    setDragging((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] == null) next[id] = false;
      });
      for (const key of Object.keys(next)) {
        if (!allVars.has(key)) delete next[key];
      }
      return next;
    });
  }, [allVars]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    randomPlayRef.current = randomPlay;
  }, [randomPlay]);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  useEffect(() => {
    isPausedRef.current = isAssignmentsPaused;
  }, [isAssignmentsPaused]);

  useEffect(() => {
    noiseConfigRef.current = noiseConfig;
  }, [noiseConfig]);

  useEffect(() => {
    rangesRef.current = ranges;
  }, [ranges]);

  useEffect(() => {
    const prev = prevAutoPlayRef.current || {};
    const combinedIds = new Set([
      ...Object.keys(prev),
      ...Object.keys(autoPlay || {}),
    ]);
    combinedIds.forEach((id) => {
      if (prev[id] && !autoPlay[id]) {
        directChangedRef.current[id] = true;
      }
    });
    prevAutoPlayRef.current = { ...autoPlay };
  }, [autoPlay]);

  useEffect(() => {
    const prev = prevRandomPlayRef.current || {};
    const combinedIds = new Set([
      ...Object.keys(prev),
      ...Object.keys(randomPlay || {}),
    ]);
    combinedIds.forEach((id) => {
      if (prev[id] && !randomPlay[id]) {
        directChangedRef.current[id] = true;
      }
    });
    prevRandomPlayRef.current = { ...randomPlay };
  }, [randomPlay]);

  useEffect(() => {
    const prev = prevInterventionsRef.current || {};
    const combinedIds = new Set([
      ...Object.keys(prev),
      ...Object.keys(interventions || {}),
    ]);
    combinedIds.forEach((id) => {
      if (prev[id] && !interventions[id]) {
        directChangedRef.current[id] = true;
      }
    });
    prevInterventionsRef.current = { ...interventions };
  }, [interventions]);

  useEffect(() => {
    const activeTargets = Object.entries(interventions || {})
      .filter(([, active]) => !!active)
      .map(([id]) => id);
    if (activeTargets.length === 0) return;
    const activeSet = new Set(activeTargets);

    const edgeIdsToClear = [];
    edgeTimersRef.current.forEach((entry, edgeId) => {
      const target = edgeId.split("->")[1];
      if (target && activeSet.has(target)) {
        entry.timers.forEach((pair) => {
          clearTimeout(pair.on);
          clearTimeout(pair.off);
          const pending = pendingTimersRef.current;
          const onIndex = pending.indexOf(pair.on);
          if (onIndex !== -1) pending.splice(onIndex, 1);
          const offIndex = pending.indexOf(pair.off);
          if (offIndex !== -1) pending.splice(offIndex, 1);
        });
        edgeIdsToClear.push(edgeId);
      }
    });

    if (edgeIdsToClear.length) {
      edgeIdsToClear.forEach((edgeId) => {
        edgeTimersRef.current.delete(edgeId);
      });
      setEdgeHot((prev) => {
        let mutated = false;
        const next = { ...prev };
        edgeIdsToClear.forEach((edgeId) => {
          if (next[edgeId]) {
            next[edgeId] = false;
            mutated = true;
          }
        });
        return mutated ? next : prev;
      });
    }
  }, [interventions]);

  const activeClamp = useMemo(
    () =>
      buildActiveClampMap(
        allVars,
        interventions,
        autoPlay,
        randomPlay,
        dragging,
        features,
        isAssignmentsPaused
      ),
    [allVars, interventions, autoPlay, randomPlay, dragging, features, isAssignmentsPaused]
  );

  const bumpNoiseEpoch = useCallback(() => {
    const cfg = noiseConfigRef.current || {};
    if (!cfg.enabled) return;
    if (isPausedRef.current) return;
    setNoiseEpoch((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (eqs.size === 0) return;
    const cfg = noiseConfigRef.current || {};
    let noiseState = null;
    if (cfg.enabled) {
      const shouldRefresh = noiseValuesRef.current.epoch !== noiseEpoch;
      if (shouldRefresh) {
        const byTarget = {};
        const byNode = {};
        const nodes = new Set();
        const scale = Math.max(0, Number(cfg.amount) || 0);
        for (const id of allVars) {
          if (!isNoiseId(id)) continue;
          const target = getNoiseTargetId(id);
          if (!target) continue;
          const range = ranges?.[target] || DEFAULT_RANGE;
          const span = range.max - range.min;
          const sigma = Math.abs(scale * (Number.isFinite(span) ? span : 0));
          const noiseValue = sigma > 0 ? sampleGaussian() * sigma : 0;
          byTarget[target] = noiseValue;
          byNode[id] = noiseValue;
          nodes.add(id);
        }
        noiseValuesRef.current = {
          enabled: true,
          amount: cfg.amount,
          epoch: noiseEpoch,
          byTarget,
          byNode,
          nodes,
        };
        nodes.forEach((id) => {
          directChangedRef.current[id] = true;
        });
      }
      if (noiseValuesRef.current.enabled) {
        noiseState = noiseValuesRef.current;
      }
    } else if (noiseValuesRef.current.enabled) {
      noiseValuesRef.current = {
        enabled: false,
        amount: 0,
        epoch: noiseEpoch,
        byTarget: {},
        byNode: {},
        nodes: new Set(),
      };
    }

    let nextRaw;
    try {
      nextRaw = computeValues(model, eqs, values, activeClamp, noiseState);
    } catch (error) {
      console.warn("Propagation error:", error);
      return;
    }
    const clamped = { ...nextRaw };
    for (const id of allVars) {
      const range = ranges[id] || DEFAULT_RANGE;
      if (clamped[id] < range.min) clamped[id] = range.min;
      if (clamped[id] > range.max) clamped[id] = range.max;
    }
    if (!shallowEqualObj(values, clamped)) {
      setValues(clamped);
    }
    setSampleValues((prev) => (shallowEqualObj(prev, clamped) ? prev : clamped));
  }, [model, eqs, activeClamp, values, ranges, allVars, noiseEpoch, noiseConfig?.enabled, noiseConfig?.amount]);

  useEffect(() => {
    const ids = Object.keys(autoPlay);
    const anyAuto = ids.some((id) => autoPlay[id]);
    if (!anyAuto || isAssignmentsPaused) return;

    const tick = () => {
      const now = performance?.now?.() ?? Date.now();
      const updates = {};
      for (const id of allVars) {
        if (!autoPlay[id]) continue;
        const range = ranges[id] || DEFAULT_RANGE;
        const period = Math.max(0.1, Number(AUTO_SLIDE_PERIOD_SECONDS) || 0);
        const start = autoStart[id] || { t0: now, p0: 0 };
        const phase = ((now - start.t0) / (period * 1000) + start.p0) % 1;
        const y = tri(phase);
        const val = range.min + y * (range.max - range.min);
        updates[id] = val;
        directChangedRef.current[id] = true;
      }
      if (Object.keys(updates).length) {
        setValues((prev) => ({ ...prev, ...updates }));
        bumpNoiseEpoch();
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [autoPlay, autoStart, ranges, allVars, isAssignmentsPaused, bumpNoiseEpoch]);

  useEffect(() => {
    const last = lastValuesRef.current;
    const changed = [];
    for (const id of allVars) {
      const a = Number(values[id] ?? 0);
      const b = Number(last[id] ?? 0);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (Math.abs(a - b) > 1e-6) changed.push(id);
    }
    lastValuesRef.current = { ...values };

    if (!features.causalFlow) {
      if (!shallowEqualObj(displayValues, values)) {
        setDisplayValues(values);
      }
      return;
    }

    const seeds = collectPropagationSeeds({
      changedIds: changed,
      directChanged: directChangedRef.current,
      interventions,
      autoPlay,
      randomPlay,
      dragging,
      features,
    });
    if (seeds.length === 0) return;

    seeds.forEach((s) => {
      delete directChangedRef.current[s];
    });

    const lag = Math.max(0, Number(features.causalLagMs || 0));
    const pulseMs = Math.max(100, Number(features.flowPulseMs || 800));

    seeds.forEach((src) => {
      setDisplayValues((prev) => ({ ...prev, [src]: values[src] }));
    });

    const plan = computePropagationPlan(seeds, parentToChildren, lag);
    for (const step of plan) {
      scheduleNodeDisplayUpdate(
        nodeUpdateTimersRef.current,
        pendingTimersRef.current,
        step.node,
        step.delay,
        createNodeDisplayUpdater(lastValuesRef, step.node, setDisplayValues)
      );

      const edgeId = `${step.parent}->${step.node}`;
      if (!interventions[step.node]) {
        scheduleEdgePulse(
          edgeTimersRef.current,
          pendingTimersRef.current,
          edgeId,
          step.delay,
          pulseMs,
          setEdgeHot
        );
      }
    }
  }, [
    values,
    allVars,
    parentToChildren,
    features.causalFlow,
    features.causalLagMs,
    features.flowPulseMs,
    displayValues,
    interventions,
    autoPlay,
    dragging,
    features.ephemeralClamp,
  ]);

  useEffect(() => {
    const prev = prevDraggingRef.current || {};
    const updates = {};
    for (const id of allVars) {
      if (prev[id] && !dragging[id]) {
        updates[id] = values[id];
      }
    }
    prevDraggingRef.current = { ...dragging };
    if (Object.keys(updates).length) {
      setDisplayValues((prev) => ({ ...prev, ...updates }));
    }
  }, [dragging, allVars, values]);

  useEffect(() => {
    return () => {
      clearPendingTimers(pendingTimersRef.current, nodeUpdateTimersRef.current, edgeTimersRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      randomTimersRef.current.forEach((timer) => clearTimeout(timer));
      randomTimersRef.current.clear();
    };
  }, []);

  const removePendingTimer = useCallback((timer) => {
    if (!timer) return;
    const list = pendingTimersRef.current;
    const idx = list.indexOf(timer);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
  }, []);

  const clearRandomTimer = useCallback(
    (id) => {
      const timers = randomTimersRef.current;
      const handle = timers.get(id);
      if (!handle) return;
      clearTimeout(handle);
      removePendingTimer(handle);
      timers.delete(id);
    },
    [removePendingTimer]
  );

  const stopAutomationFor = useCallback(
    (id) => {
      if (randomPlayRef.current?.[id]) {
        setRandomPlay((prev) => {
          if (!prev[id]) return prev;
          clearRandomTimer(id);
          return { ...prev, [id]: false };
        });
      }
      if (autoPlayRef.current?.[id]) {
        setAutoPlay((prev) => {
          if (!prev[id]) return prev;
          return { ...prev, [id]: false };
        });
      }
    },
    [clearRandomTimer]
  );

  const applyValue = useCallback(
    (id, raw, { syncAutoPhase, bumpNoise = true } = {}) => {
      const range = ranges[id] || DEFAULT_RANGE;
      const clamped = clampToRange(raw, range);
      const currentValue = valuesRef.current?.[id] ?? lastValuesRef.current?.[id];
      if (currentValue === clamped) {
        return clamped;
      }
      directChangedRef.current[id] = true;

      setValues((prev) => {
        if (prev[id] === clamped) return prev;
        return { ...prev, [id]: clamped };
      });
      setDisplayValues((prev) => {
        if (prev[id] === clamped) return prev;
        return { ...prev, [id]: clamped };
      });

      if (syncAutoPhase && autoPlay[id]) {
        const span = range.max - range.min || 1;
        const y = (clamped - range.min) / span;
        const p0 = Math.max(0, Math.min(1, y / 2));
        const now = performance?.now?.() ?? Date.now();
        setAutoStart((prev) => ({ ...prev, [id]: { t0: now, p0 } }));
      }

      if (bumpNoise && !isNoiseId(id)) {
        bumpNoiseEpoch();
      }

      return clamped;
    },
    [ranges, autoPlay, bumpNoiseEpoch]
  );

  const handleValueChange = useCallback(
    (id, raw) => {
      if (isPausedRef.current) return;
      stopAutomationFor(id);
      applyValue(id, raw, { syncAutoPhase: true });
    },
    [applyValue, stopAutomationFor]
  );

  const handleValueCommit = useCallback(
    (id, raw) => {
      if (isPausedRef.current) return;
      stopAutomationFor(id);
      applyValue(id, raw);
    },
    [applyValue, stopAutomationFor]
  );

  useEffect(() => {
    if (isAssignmentsPaused) {
      randomTimersRef.current.forEach((timer) => clearTimeout(timer));
      randomTimersRef.current.clear();
      return;
    }
    const timers = randomTimersRef.current;

    timers.forEach((_, id) => {
      if (!randomPlay[id]) {
        clearRandomTimer(id);
      }
    });

    const activeIds = Object.keys(randomPlay).filter((id) => randomPlay[id]);

    activeIds.forEach((id) => {
      clearRandomTimer(id);
      startRandomLoop(id);
    });

    function startRandomLoop(id) {
      function scheduleNext() {
        if (!randomPlayRef.current[id]) {
          clearRandomTimer(id);
          return;
        }
        const delay = Math.max(50, Number(RANDOM_UPDATE_INTERVAL_MS) || 0);
        const timer = setTimeout(() => {
          removePendingTimer(timer);
          randomTimersRef.current.delete(id);
          tick();
        }, delay);
        randomTimersRef.current.set(id, timer);
        pendingTimersRef.current.push(timer);
      }

      function tick() {
        if (!randomPlayRef.current[id]) {
          clearRandomTimer(id);
          return;
        }
        try {
          const currentRanges = rangesRef.current || {};
          const range = currentRanges[id] || DEFAULT_RANGE;
          const span = range.max - range.min;
          const raw = span === 0 ? range.min : range.min + Math.random() * span;
          if (!Number.isFinite(raw)) {
            throw new Error(`Random draw produced non-finite value for ${id}`);
          }
          const quantized = Math.round(raw);
          applyValue(id, quantized);
          scheduleNext();
        } catch (error) {
          console.warn("Random play error:", error);
          clearRandomTimer(id);
          setRandomPlay((prev) => ({ ...prev, [id]: false }));
        }
      }

      tick();
    }
  }, [randomPlay, applyValue, clearRandomTimer, removePendingTimer, isAssignmentsPaused]);

  const handleRangeMinChange = useCallback(
    (id, raw) => {
      if (isPausedRef.current) return;
      const current = ranges[id] || DEFAULT_RANGE;
      let min = Number(raw);
      if (!Number.isFinite(min)) min = current.min;
      let max = current.max;
      if (min >= max) {
        max = min + 1;
      }
      const nextRange = { min, max };
      setRanges((prev) => ({ ...prev, [id]: nextRange }));
      setValues((prev) => {
        const currentValue = prev[id];
        const clamped = clampToRange(currentValue, nextRange);
        if (clamped === currentValue) return prev;
        return { ...prev, [id]: clamped };
      });
      setDisplayValues((prev) => {
        const currentValue = prev[id];
        const clamped = clampToRange(currentValue, nextRange);
        if (clamped === currentValue) return prev;
        return { ...prev, [id]: clamped };
      });
    },
    [ranges]
  );

  const handleRangeMaxChange = useCallback(
    (id, raw) => {
      if (isPausedRef.current) return;
      const current = ranges[id] || DEFAULT_RANGE;
      let max = Number(raw);
      if (!Number.isFinite(max)) max = current.max;
      let min = current.min;
      if (max <= min) {
        min = max - 1;
      }
      const nextRange = { min, max };
      setRanges((prev) => ({ ...prev, [id]: nextRange }));
      setValues((prev) => {
        const currentValue = prev[id];
        const clamped = clampToRange(currentValue, nextRange);
        if (clamped === currentValue) return prev;
        return { ...prev, [id]: clamped };
      });
      setDisplayValues((prev) => {
        const currentValue = prev[id];
        const clamped = clampToRange(currentValue, nextRange);
        if (clamped === currentValue) return prev;
        return { ...prev, [id]: clamped };
      });
    },
    [ranges]
  );

  const toggleAutoPlay = useCallback(
    (id) => {
      if (isPausedRef.current) return;
      setAutoPlay((prev) => {
        const wasActive = !!prev[id];
        const next = { ...prev, [id]: !wasActive };
        if (!wasActive) {
          const now = performance?.now?.() ?? Date.now();
          setAutoStart((prevStart) => ({ ...prevStart, [id]: { t0: now, p0: 0 } }));
          setRandomPlay((prevRandom) => {
            if (!prevRandom[id]) return prevRandom;
            clearRandomTimer(id);
            return { ...prevRandom, [id]: false };
          });
        }
        return next;
      });
    },
    [clearRandomTimer]
  );

  const toggleRandomPlay = useCallback(
    (id) => {
      if (isPausedRef.current) return;
      setRandomPlay((prev) => {
        const wasActive = !!prev[id];
        const nextActive = !wasActive;
        const next = { ...prev, [id]: nextActive };
        if (nextActive) {
          setAutoPlay((prevAuto) => {
            if (!prevAuto[id]) return prevAuto;
            return { ...prevAuto, [id]: false };
          });
        } else {
          clearRandomTimer(id);
        }
        return next;
      });
    },
    [clearRandomTimer]
  );

  const setClamp = useCallback(
    (id, value) => {
      if (isPausedRef.current) return;
      if (value) {
        setRandomPlay((prevRandom) => {
          if (!prevRandom[id]) return prevRandom;
          clearRandomTimer(id);
          return { ...prevRandom, [id]: false };
        });
        setAutoPlay((prevAuto) => {
          if (!prevAuto[id]) return prevAuto;
          return { ...prevAuto, [id]: false };
        });
      }
      setInterventions((prev) => ({ ...prev, [id]: value }));
    },
    [clearRandomTimer]
  );

  const handleDragStart = useCallback((id) => {
    if (isPausedRef.current) return;
    setDragging((prev) => ({ ...prev, [id]: true }));
  }, []);

  const handleDragEnd = useCallback((id) => {
    if (isPausedRef.current) return;
    directChangedRef.current[id] = true;
    setDragging((prev) => ({ ...prev, [id]: false }));
  }, []);

  const toggleAssignmentsPaused = useCallback(() => {
    setIsAssignmentsPaused((prev) => {
      const next = !prev;
      if (next) {
        setDragging(buildFlagMap());
      } else {
        setAutoStart(buildAutoStartMap(autoPlayRef.current));
      }
      return next;
    });
  }, [buildAutoStartMap, buildFlagMap]);

  const resetAssignments = useCallback(() => {
    setIsAssignmentsPaused(false);
    isPausedRef.current = false;

    clearPendingTimers(pendingTimersRef.current, nodeUpdateTimersRef.current, edgeTimersRef.current);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    randomTimersRef.current.forEach((timer) => clearTimeout(timer));
    randomTimersRef.current.clear();

    const resetValues = {};
    for (const id of allVars) {
      resetValues[id] = 0;
    }

    const resetFlags = buildFlagMap();
    setValues(resetValues);
    setDisplayValues(resetValues);
    setSampleValues(resetValues);
    setInterventions(resetFlags);
    setRanges(buildRangeMap());
    setAutoPlay(resetFlags);
    setRandomPlay(resetFlags);
    setDragging(resetFlags);
    setAutoStart(buildAutoStartMap(resetFlags));
    setEdgeHot({});
    directChangedRef.current = {};
    prevAutoPlayRef.current = {};
    prevRandomPlayRef.current = {};
    prevInterventionsRef.current = {};
    bumpNoiseEpoch();
  }, [allVars, buildAutoStartMap, buildFlagMap, buildRangeMap, bumpNoiseEpoch]);

  return {
    values,
    displayValues,
    sampleValues,
    interventions,
    ranges,
    autoPlay,
    randomPlay,
    dragging,
    edgeHot,
    isAssignmentsPaused,
    toggleAutoPlay,
    toggleRandomPlay,
    setClamp,
    handleValueChange,
    handleValueCommit,
    handleRangeMinChange,
    handleRangeMaxChange,
    handleDragStart,
    handleDragEnd,
    toggleAssignmentsPaused,
    resetAssignments,
  };
}

export const __TEST_ONLY__ = {
  clampToRange,
  tri,
  computePropagationPlan,
  buildActiveClampMap,
  collectPropagationSeeds,
  createNodeDisplayUpdater,
};

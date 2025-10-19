import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeValues, shallowEqualObj } from "../graph/math.js";
import { scheduleEdgePulse, scheduleNodeDisplayUpdate, clearPendingTimers } from "../utils/timers.js";
import { tri } from "../data/presets.js";

const DEFAULT_RANGE = { min: -100, max: 100 };

function buildActiveClampMap(allVars, interventions, autoPlay, dragging, features) {
  const out = {};
  const useEphemeral = !!(features && features.ephemeralClamp);
  for (const id of allVars) {
    out[id] = !!interventions[id] || !!autoPlay[id] || (useEphemeral && !!dragging[id]);
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

function collectPropagationSeeds({
  changedIds,
  directChanged,
  interventions,
  autoPlay,
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
      (useEphemeral && dragging[id])
    ) {
      out.push(id);
    }
  }
  return out;
}

export function usePropagationEffects({ model, eqs, allVars, features }) {
  const [values, setValues] = useState({});
  const [displayValues, setDisplayValues] = useState({});
  const [interventions, setInterventions] = useState({});
  const [ranges, setRanges] = useState({});
  const [autoPlay, setAutoPlay] = useState({});
  const [autoPeriod, setAutoPeriod] = useState({});
  const [autoStart, setAutoStart] = useState({});
  const [dragging, setDragging] = useState({});
  const [edgeHot, setEdgeHot] = useState({});

  const directChangedRef = useRef({});
  const lastValuesRef = useRef({});
  const prevDraggingRef = useRef({});
  const pendingTimersRef = useRef([]);
  const nodeUpdateTimersRef = useRef(new Map());
  const edgeTimersRef = useRef(new Map());
  const rafRef = useRef(null);

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
    setAutoPeriod((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] == null) next[id] = 4;
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

  const activeClamp = useMemo(
    () => buildActiveClampMap(allVars, interventions, autoPlay, dragging, features),
    [allVars, interventions, autoPlay, dragging, features]
  );

  useEffect(() => {
    if (eqs.size === 0) return;
    const nextRaw = computeValues(model, eqs, values, activeClamp);
    const clamped = { ...nextRaw };
    for (const id of allVars) {
      const range = ranges[id] || DEFAULT_RANGE;
      if (clamped[id] < range.min) clamped[id] = range.min;
      if (clamped[id] > range.max) clamped[id] = range.max;
    }
    if (!shallowEqualObj(values, clamped)) {
      setValues(clamped);
    }
  }, [model, eqs, activeClamp, values, ranges, allVars]);

  useEffect(() => {
    const ids = Object.keys(autoPlay);
    const anyAuto = ids.some((id) => autoPlay[id]);
    if (!anyAuto) return;

    const tick = () => {
      const now = performance?.now?.() ?? Date.now();
      const updates = {};
      for (const id of allVars) {
        if (!autoPlay[id]) continue;
        const range = ranges[id] || DEFAULT_RANGE;
        const period = Math.max(0.1, Number(autoPeriod[id] || 4));
        const start = autoStart[id] || { t0: now, p0: 0 };
        const phase = ((now - start.t0) / (period * 1000) + start.p0) % 1;
        const y = tri(phase);
        const val = range.min + y * (range.max - range.min);
        updates[id] = val;
        directChangedRef.current[id] = true;
      }
      if (Object.keys(updates).length) {
        setValues((prev) => ({ ...prev, ...updates }));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [autoPlay, autoPeriod, autoStart, ranges, allVars]);

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
        () => setDisplayValues((prev) => ({ ...prev, [step.node]: values[step.node] }))
      );

      const edgeId = `${step.parent}->${step.node}`;
      scheduleEdgePulse(
        edgeTimersRef.current,
        pendingTimersRef.current,
        edgeId,
        step.delay,
        pulseMs,
        setEdgeHot
      );
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
    };
  }, []);

  const applyValue = useCallback(
    (id, raw, { syncAutoPhase } = {}) => {
      const range = ranges[id] || DEFAULT_RANGE;
      const clamped = clampToRange(raw, range);
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

      return clamped;
    },
    [ranges, autoPlay]
  );

  const handleValueChange = useCallback(
    (id, raw) => applyValue(id, raw, { syncAutoPhase: true }),
    [applyValue]
  );

  const handleValueCommit = useCallback(
    (id, raw) => applyValue(id, raw),
    [applyValue]
  );

  const handleRangeMinChange = useCallback(
    (id, raw) => {
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

  const toggleAutoPlay = useCallback((id) => {
    setAutoPlay((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (!prev[id]) {
        const now = performance?.now?.() ?? Date.now();
        setAutoStart((prevStart) => ({ ...prevStart, [id]: { t0: now, p0: 0 } }));
      }
      return next;
    });
  }, []);

  const setClamp = useCallback((id, value) => {
    setInterventions((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleAutoPeriodChange = useCallback((id, raw) => {
    const sec = Math.max(0.1, Number(raw) || 0.1);
    setAutoPeriod((prev) => ({ ...prev, [id]: sec }));
  }, []);

  const handleDragStart = useCallback((id) => {
    setDragging((prev) => ({ ...prev, [id]: true }));
  }, []);

  const handleDragEnd = useCallback((id) => {
    setDragging((prev) => ({ ...prev, [id]: false }));
  }, []);

  return {
    values,
    displayValues,
    interventions,
    ranges,
    autoPlay,
    autoPeriod,
    dragging,
    edgeHot,
    toggleAutoPlay,
    setClamp,
    handleValueChange,
    handleValueCommit,
    handleRangeMinChange,
    handleRangeMaxChange,
    handleAutoPeriodChange,
    handleDragStart,
    handleDragEnd,
  };
}

export const __TEST_ONLY__ = {
  clampToRange,
  tri,
  computePropagationPlan,
  buildActiveClampMap,
  collectPropagationSeeds,
};

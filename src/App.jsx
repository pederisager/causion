import React, { useMemo, useState, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  Handle,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  getStraightPath,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { scheduleNodeDisplayUpdate, scheduleEdgePulse } from "./utils/lagScheduler";
import { buildGraphSignature } from "./utils/graphSignature";

/**
 * DAG Visual Simulation App — Causal Flow (Marching Ants, Restored Features)
 *
 * - Preserves seeded causal-lag visuals (only direct sources seed; children update after depth * lag)
 * - Preserves immediate visual feedback for source node being manipulated
 * - Preserves do-clamp, autoplay, ephemeral clamp-while-dragging
 * - High-contrast marching-ants pulses on edges while influence propagates
 * - Straight edges with auto T/R/B/L anchoring; auto-layout optional
 */

// ===================== FEATURE FLAGS =====================
const defaultFeatures = {
  ephemeralClamp: true,      // clamp only while slider is dragged
  edgeStraightening: true,   // use straight edges
  anchorHandles: true,       // pick T/R/B/L handles based on geometry
  layoutFreeform: false,     // if true, retain manual positions
  causalFlow: true,          // enable visual lag + pulses
  causalLagMs: 250,          // delay per hop (ms)
  flowPulseMs: 900,          // pulse duration per hop (ms)
};

// ===================== PARSER =====================
function parseSCM(text) {
  const lines = text
    .split(/[;\n]/)
    .map((l) => l.trim())
    .filter(Boolean);

  const model = new Map();
  const allVars = new Set();

  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!m) throw new Error('Cannot parse: "' + line + '"');
    const child = m[1];
    const rhs = m[2];

    const norm = rhs.replace(/-/g, "+ -");
    const terms = norm.split("+").map((t) => t.trim()).filter(Boolean);

    const parents = {};
    let constant = 0;

    for (const term of terms) {
      if (/^error$/i.test(term)) continue;
      if (/^[+-]?\d*\.?\d+(e[+-]?\d+)?$/i.test(term)) { constant += parseFloat(term); continue; }
      const star = term.indexOf("*");
      let coeff = 1; let v = term;
      if (star !== -1) { coeff = parseFloat(term.slice(0, star)); v = term.slice(star + 1).trim(); }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) throw new Error('Unsupported term: "' + term + '" in line "' + line + '"');
      parents[v] = (parents[v] ?? 0) + (isNaN(coeff) ? 1 : coeff);
    }

    if (model.has(child)) throw new Error("Duplicate definition for " + child);
    model.set(child, { parents, constant });
    allVars.add(child); Object.keys(parents).forEach((p) => allVars.add(p));
  }

  for (const v of allVars) if (!model.has(v)) model.set(v, { parents: {}, constant: 0 });
  return { model, allVars };
}

function depsFromModel(model) {
  const eqs = new Map();
  for (const [child, spec] of model) eqs.set(child, new Set(Object.keys(spec.parents)));
  return eqs;
}

// ===================== TOPO + LAYOUT =====================
function topoSort(eqs) {
  const nodeIds = [...eqs.keys()];
  const indeg = new Map(nodeIds.map((n) => [n, 0]));
  for (const [child, parents] of eqs) for (const p of parents) indeg.set(child, (indeg.get(child) || 0) + 1);
  const q = nodeIds.filter((n) => (indeg.get(n) || 0) === 0);
  const order = [];
  while (q.length) {
    const n = q.shift(); order.push(n);
    for (const [child, parents] of eqs) if (parents.has(n)) { indeg.set(child, indeg.get(child) - 1); if (indeg.get(child) === 0) q.push(child); }
  }
  if (order.length !== nodeIds.length) throw new Error("SCM contains a cycle (not a DAG).");
  return order;
}

const NODE_W = 120; const NODE_H = 120; const RANK_SEP = 160; const NODE_SEP = 40;
function layoutLeftRight(eqs) {
  const order = topoSort(eqs); const rank = {};
  for (const id of order) { const parents = [...(eqs.get(id) || [])]; rank[id] = parents.length ? Math.max.apply(null, parents.map((p) => rank[p] || 0)) + 1 : 0; }
  const buckets = new Map(); for (const id of order) { const r = rank[id]; if (!buckets.has(r)) buckets.set(r, []); buckets.get(r).push(id); }
  let maxRows = 0; for (const arr of buckets.values()) maxRows = Math.max(maxRows, arr.length);
  const xForRank = (r) => 50 + r * (NODE_W + RANK_SEP);
  const pos = {}; for (const [r, arr] of buckets) { const totalH = arr.length * (NODE_H + NODE_SEP) - NODE_SEP; const startY = Math.max(50, (maxRows * (NODE_H + NODE_SEP) - NODE_SEP - totalH) / 2 + 50); arr.forEach((id, i) => (pos[id] = { x: xForRank(r), y: startY + i * (NODE_H + NODE_SEP) })); }
  return pos;
}

function pickHandleFromDelta(dx, dy) { const adx = Math.abs(dx), ady = Math.abs(dy); if (adx >= ady) return dx >= 0 ? 'R' : 'L'; return dy >= 0 ? 'B' : 'T'; }
function nodeCenter(node) { return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H / 2 }; }

// ===================== PROPAGATION (math) =====================
function computeValues(model, eqs, currentValues, clampMap) {
  const order = topoSort(eqs);
  const next = { ...currentValues };
  for (const n of order) {
    if (clampMap[n]) continue;
    const spec = model.get(n) || { parents: {}, constant: 0 };
    let sum = 0; for (const [p, c] of Object.entries(spec.parents)) sum += c * (next[p] ?? 0);
    next[n] = spec.constant + sum;
  }
  return next;
}
function shallowEqualObj(a, b) { const ka = Object.keys(a); const kb = Object.keys(b); if (ka.length !== kb.length) return false; for (const k of ka) if (a[k] !== b[k]) return false; return true; }

function valueToColor(v, range = 100) {
  const x = Math.max(-range, Math.min(range, Number(v) || 0));
  const t = Math.min(Math.abs(x) / range, 1);
  if (x >= 0) { const r = Math.round(255 * (1 - t)); const g = 255; const b = Math.round(255 * (1 - t)); return `rgb(${r},${g},${b})`; }
  else { const r = 255; const g = Math.round(255 * (1 - t)); const b = Math.round(255 * (1 - t)); return `rgb(${r},${g},${b})`; }
}

// ===================== NODE UI =====================
function CircleNode({ data }) {
  const { id, value, min = -100, max = 100 } = data;
  const rangeScale = Math.max(Math.abs(min), Math.abs(max));
  return (
    <div style={{ width: NODE_W, height: NODE_H, borderRadius: "50%", background: valueToColor(value, rangeScale), border: "3px solid #111", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", fontWeight: 800, fontSize: 22, boxShadow: "0 10px 24px rgba(0,0,0,0.15)", userSelect: "none" }}>
      <div>{id}</div>
      <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.8, marginTop: 6 }}>{Number(value ?? 0).toFixed(2)}</div>
      {/* targets T/R/B/L */}
      <Handle id="T_t" type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle id="R_t" type="target" position={Position.Right} style={{ opacity: 0 }} />
      <Handle id="B_t" type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle id="L_t" type="target" position={Position.Left} style={{ opacity: 0 }} />
      {/* sources T/R/B/L */}
      <Handle id="T_s" type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle id="R_s" type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle id="B_s" type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle id="L_s" type="source" position={Position.Left} style={{ opacity: 0 }} />
    </div>
  );
}
const nodeTypes = { circle: CircleNode };

// ===================== PRESETS =====================
const PRESET_1 = `Med = 0.5*A\nB = 0.5*Med`;
const PRESET_2 = `A = 0.5*Con\nB = 0.5*Con`;
const PRESET_3 = `Col = 0.5*A + 0.5*B`;

function tri(p) { const t = p - Math.floor(p); return t < 0.5 ? (t * 2) : (2 - t * 2); }

// ===================== DEV PANEL =====================
function DevPanel({ features, setFeatures }) {
  return (
    <div className="rounded-2xl shadow p-4 border">
      <div className="text-lg font-bold mb-2">Dev Panel (feature flags)</div>
      {Object.entries(features).map(([k, v]) => (
        <label key={k} className="block text-sm mb-2">
          {typeof v === 'boolean' ? (
            <>
              <input type="checkbox" className="mr-2" checked={!!v} onChange={(e) => setFeatures((prev) => ({ ...prev, [k]: e.target.checked }))} />
              {k}
            </>
          ) : (
            <>
              <span className="mr-2 inline-block w-36">{k}</span>
              <input type="number" className="w-28 border rounded px-2 py-1" value={Number(v)} onChange={(e) => setFeatures((prev) => ({ ...prev, [k]: Number(e.target.value) }))} />
            </>
          )}
        </label>
      ))}
    </div>
  );
}

// ===================== CUSTOM EDGE (marching ants) =====================
function CausalEdge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const hot = !!(data && data.hot);
  const pulseMs = Math.max(100, Number(data?.pulseMs || 800));
  const animSec = Math.max(0.3, pulseMs / 800); // tie speed to pulse length
  return (
    <g>
      {/* Base edge for constant legibility */}
      <path d={edgePath} fill="none" stroke="#111" strokeWidth={hot ? 3 : 2} />

      {/* High-contrast marching ants overlay (parent -> child) */}
      {hot && (
        <path
          d={edgePath}
          fill="none"
          stroke="#fff"
          strokeWidth={hot ? 3.5 : 3}
          strokeDasharray="8 8"
          strokeLinecap="butt"
          style={{ animation: `antsForward ${animSec}s linear infinite` }}
        />
      )}

      {/* Arrowhead */}
      <defs>
        <marker id={`arrow-${id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#111" />
        </marker>
      </defs>
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={2} markerEnd={`url(#arrow-${id})`} />
    </g>
  );
}
const edgeTypes = { causal: CausalEdge };

// ===================== APP =====================
function App() {
  return (
    <ReactFlowProvider>
      <CoreApp />
    </ReactFlowProvider>
  );
}

function CoreApp() {
  const reactFlow = useReactFlow();
  const [features, setFeatures] = useState(defaultFeatures);
  const [scmText, setScmText] = useState(PRESET_1);
  const [error, setError] = useState("");

  // truth values vs. lagged visuals
  const [values, setValues] = useState({});
  const [displayValues, setDisplayValues] = useState({});

  // controls
  const [interventions, setInterventions] = useState({});
  const [ranges, setRanges] = useState({});
  const [autoPlay, setAutoPlay] = useState({});
  const [autoPeriod, setAutoPeriod] = useState({});
  const [autoStart, setAutoStart] = useState({});
  const [dragging, setDragging] = useState({});

  // pulses + bookkeeping
  const [edgeHot, setEdgeHot] = useState({});
  const pendingTimersRef = useRef([]);
  const nodeUpdateTimersRef = useRef(new Map());
  const edgeTimersRef = useRef(new Map());
  const directChangedRef = useRef({}); // marks direct sources to seed propagation
  const prevDraggingRef = useRef({}); // track previous dragging to detect drop events

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Parse SCM
  const parsed = useMemo(() => {
    try {
      const res = parseSCM(scmText);
      const eqs = depsFromModel(res.model);
      topoSort(eqs);
      setError("");
      return { ...res, eqs };
    } catch (e) {
      setError(e.message || String(e));
      return { model: new Map(), eqs: new Map(), allVars: new Set() };
    }
  }, [scmText]);
  const { model, eqs, allVars } = parsed;
  const graphSignature = useMemo(() => buildGraphSignature(eqs), [eqs]);

  // Ensure state maps cover all vars
  useEffect(() => {
    const ids = [...allVars];
    setValues((prev) => { const n = { ...prev }; ids.forEach((id) => { if (n[id] == null) n[id] = 0; }); Object.keys(n).forEach((k) => { if (!allVars.has(k)) delete n[k]; }); return n; });
    setDisplayValues((prev) => { const n = { ...prev }; ids.forEach((id) => { if (n[id] == null) n[id] = 0; }); Object.keys(n).forEach((k) => { if (!allVars.has(k)) delete n[k]; }); return n; });
    setInterventions((prev) => { const n = { ...prev }; ids.forEach((id) => { if (n[id] == null) n[id] = false; }); Object.keys(n).forEach((k) => { if (!allVars.has(k)) delete n[k]; }); return n; });
    setRanges((prev) => { const n = { ...prev }; ids.forEach((id) => { if (!n[id]) n[id] = { min: -100, max: 100 }; }); Object.keys(n).forEach((k) => { if (!allVars.has(k)) delete n[k]; }); return n; });
    const now = performance?.now?.() ?? Date.now();
    setAutoPlay((prev) => { const n = { ...prev }; ids.forEach((id) => { if (n[id] == null) n[id] = false; }); Object.keys(n).forEach((k) => { if (!allVars.has(k)) delete n[k]; }); return n; });
    setAutoPeriod((prev) => { const n = { ...prev }; ids.forEach((id) => { if (n[id] == null) n[id] = 4; }); Object.keys(n).forEach((k) => { if (!allVars.has(k)) delete n[k]; }); return n; });
    setAutoStart((prev) => { const n = { ...prev }; ids.forEach((id) => { if (!n[id]) n[id] = { t0: now, p0: 0 }; }); Object.keys(n).forEach((k) => { if (!allVars.has(k)) delete n[k]; }); return n; });
    setDragging((prev) => { const n = { ...prev }; ids.forEach((id) => { if (n[id] == null) n[id] = false; }); Object.keys(n).forEach((k) => { if (!allVars.has(k)) delete n[k]; }); return n; });
  }, [allVars]);

  // Active clamp: permanent OR autoplay OR (optional) while dragging
  const activeClamp = useMemo(() => {
    const out = {};
    for (const id of allVars) out[id] = !!interventions[id] || !!autoPlay[id] || (features.ephemeralClamp && !!dragging[id]);
    return out;
  }, [allVars, interventions, autoPlay, dragging, features.ephemeralClamp]);

  // Propagate truth values; then range-clamp
  useEffect(() => {
    if (eqs.size === 0) return;
    const nextRaw = computeValues(model, eqs, values, activeClamp);
    const clamped = { ...nextRaw };
    for (const id of allVars) {
      const r = ranges[id] || { min: -100, max: 100 };
      if (clamped[id] < r.min) clamped[id] = r.min;
      if (clamped[id] > r.max) clamped[id] = r.max;
    }
    if (!shallowEqualObj(values, clamped)) setValues(clamped);
  }, [model, eqs, activeClamp, values, ranges, allVars]);

  // Auto-play loop (also seeds direct changes)
  useEffect(() => {
    let raf = null;
    const anyAuto = Object.values(autoPlay).some(Boolean);
    if (!anyAuto) return;
    const tick = () => {
      const now = performance?.now?.() ?? Date.now();
      const updates = {};
      for (const id of allVars) {
        if (!autoPlay[id]) continue;
        const r = ranges[id] || { min: -100, max: 100 };
        const period = Math.max(0.1, Number(autoPeriod[id] || 4));
        const st = autoStart[id] || { t0: now, p0: 0 };
        const p = ((now - st.t0) / (period * 1000) + st.p0) % 1;
        const y = tri(p);
        const val = r.min + y * (r.max - r.min);
        updates[id] = val;
        directChangedRef.current[id] = true; // seed
      }
      if (Object.keys(updates).length) setValues((prev) => ({ ...prev, ...updates }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [autoPlay, autoPeriod, autoStart, ranges, allVars]);

  // Build nodes from displayValues (visual lag)
  useEffect(() => {
    if (eqs.size === 0) { setNodes([]); return; }
    const positions = features.layoutFreeform ? null : layoutLeftRight(eqs);
    const ids = [...allVars];
    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      return ids.map((id) => {
        const prevNode = prevMap.get(id);
        const pos = prevNode ? prevNode.position : (positions ? positions[id] : { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 });
        const r = ranges[id] || { min: -100, max: 100 };
        return { id, type: "circle", position: pos, data: { id, value: (displayValues[id] ?? 0), min: r.min, max: r.max }, draggable: true };
      });
    });
  }, [eqs, allVars, displayValues, ranges, setNodes, features.layoutFreeform]);

  // Build edges
  function mapHandleId(code, kind /* 's' | 't' */) { switch (code) { case 'T': return `T_${kind}`; case 'R': return `R_${kind}`; case 'B': return `B_${kind}`; case 'L': return `L_${kind}`; default: return undefined; } }
  useEffect(() => {
    if (eqs.size === 0) { setEdges([]); return; }
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const nextEdges = [];
    for (const [child, parents] of eqs) {
      const tgt = nodeMap.get(child); if (!tgt) continue; const tc = nodeCenter(tgt);
      for (const p of parents) {
        const src = nodeMap.get(p); if (!src) continue; const sc = nodeCenter(src);
        const dx = tc.x - sc.x; const dy = tc.y - sc.y;
        let sourceHandle, targetHandle;
        if (features.anchorHandles) { const sHandle = pickHandleFromDelta(dx, dy); const tHandle = pickHandleFromDelta(-dx, -dy); sourceHandle = mapHandleId(sHandle, 's'); targetHandle = mapHandleId(tHandle, 't'); }
        const id = p + "->" + child;
        nextEdges.push({ id, source: p, target: child, sourceHandle, targetHandle, type: features.causalFlow ? 'causal' : (features.edgeStraightening ? 'straight' : undefined), data: { hot: !!edgeHot[id], pulseMs: features.flowPulseMs }, style: { strokeWidth: 2, stroke: '#111' }, markerEnd: { type: MarkerType.ArrowClosed, width: 30, height: 30, color: '#111' } });
      }
    }
    setEdges(nextEdges);
  }, [eqs, nodes, setEdges, features.edgeStraightening, features.anchorHandles, features.causalFlow, features.flowPulseMs, edgeHot]);

  // parent -> children adjacency
  const parentToChildren = useMemo(() => {
    const m = new Map();
    for (const [child, parents] of eqs) {
      for (const p of parents) { if (!m.has(p)) m.set(p, new Set()); m.get(p).add(child); }
    }
    return m;
  }, [eqs]);

  // VISUAL LAG & EDGE PULSES (seeded only from direct sources/controlled vars)
  const lastValuesRef = useRef({});
  useEffect(() => {
    const last = lastValuesRef.current;
    const changed = [];
    for (const id of allVars) {
      const a = Number(values[id] ?? 0), b = Number(last[id] ?? 0);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (Math.abs(a - b) > 1e-6) changed.push(id);
    }
    lastValuesRef.current = { ...values };

    if (!features.causalFlow) {
      if (!shallowEqualObj(displayValues, values)) setDisplayValues(values);
      return;
    }

    // Seed only from direct sources: user-manipulated, clamped, autoplay, or dragging (if ephemeralClamp)
    const seeds = changed.filter((id) => directChangedRef.current[id] || interventions[id] || autoPlay[id] || (features.ephemeralClamp && dragging[id]));
    if (seeds.length === 0) return;
    seeds.forEach((s) => { delete directChangedRef.current[s]; });

    const lag = Math.max(0, Number(features.causalLagMs || 0));
    const pulseMs = Math.max(100, Number(features.flowPulseMs || 800));

    const seenNodeAtDepth = new Map();
    const queue = [];

    // immediate visual update for sources
    for (const src of seeds) {
      seenNodeAtDepth.set(src, 0);
      queue.push([src, 0]);
      setDisplayValues((prev) => ({ ...prev, [src]: values[src] }));
    }

    // BFS over DAG, scheduling child updates strictly after depth * lag
    while (queue.length) {
      const [u, d] = queue.shift();
      const children = parentToChildren.get(u);
      if (!children) continue;
      for (const v of children) {
        const nd = d + 1;
        if (seenNodeAtDepth.has(v) && seenNodeAtDepth.get(v) <= nd) continue;
        seenNodeAtDepth.set(v, nd);
        queue.push([v, nd]);
        const delay = nd * lag;

        scheduleNodeDisplayUpdate(
          nodeUpdateTimersRef.current,
          pendingTimersRef.current,
          v,
          delay,
          () => setDisplayValues((prev) => ({ ...prev, [v]: values[v] }))
        );

        const edgeId = u + '->' + v;
        scheduleEdgePulse(
          edgeTimersRef.current,
          pendingTimersRef.current,
          edgeId,
          delay,
          pulseMs,
          setEdgeHot
        );
      }
    }
  }, [values, allVars, parentToChildren, features.causalFlow, features.causalLagMs, features.flowPulseMs, displayValues, interventions, autoPlay, dragging, features.ephemeralClamp]);

  // Keep the viewport steady while still fitting freshly parsed graphs once
  useEffect(() => {
    if (!reactFlow) return;
    if (!nodes.length) return;
    reactFlow.fitView({ padding: 0.12, duration: 350 });
  }, [reactFlow, nodes.length, graphSignature, features.layoutFreeform]);

  // Sync display values when a slider drag ends (fix: ensure node resets with slider)
  useEffect(() => {
    const prev = prevDraggingRef.current || {};
    const updates = {};
    for (const id of allVars) {
      if (prev[id] && !dragging[id]) {
        // Drag just ended for this id — bring display in sync with truth
        updates[id] = values[id];
      }
    }
    prevDraggingRef.current = { ...dragging };
    if (Object.keys(updates).length) setDisplayValues((prev) => ({ ...prev, ...updates }));
  }, [dragging, allVars, values]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    pendingTimersRef.current.forEach(clearTimeout);
    nodeUpdateTimersRef.current.forEach((timer) => clearTimeout(timer));
    nodeUpdateTimersRef.current.clear();
    edgeTimersRef.current.forEach((pair) => {
      clearTimeout(pair.on);
      clearTimeout(pair.off);
    });
    edgeTimersRef.current.clear();
  }, []);

  return (
    <div className="w-full h-full grid grid-cols-12 gap-4 p-4" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system" }}>
      <div className="col-span-4 space-y-4">
        <h1 className="text-3xl font-extrabold">Interactive DAG</h1>
        <DevPanel features={features} setFeatures={setFeatures} />

        <div className="rounded-2xl shadow p-4 border">
          <div className="text-lg font-bold mb-2">SCM</div>
          <div className="flex gap-2 mb-2">
            <button className="px-3 py-1 rounded-lg border" onClick={() => setScmText(PRESET_1)}>Load Mediation</button>
            <button className="px-3 py-1 rounded-lg border" onClick={() => setScmText(PRESET_2)}>Load Confounding</button>
            <button className="px-3 py-1 rounded-lg border" onClick={() => setScmText(PRESET_3)}>Load Collider</button>
          </div>
          <textarea className="w-full h-48 p-2 rounded-xl border" value={scmText} onChange={(e) => setScmText(e.target.value)} />
          <div className="text-xs text-gray-600 mt-2">Linear only. Example: <code>Med = 0.5*A</code>. Arrows point from RHS vars to LHS var.</div>
          {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="rounded-2xl shadow p-4 border">
          <div className="text-lg font-bold mb-2">Assign Values (intervene)</div>
          {[...allVars].sort().map((id) => (
            <div key={id} className="mb-4">
              <div className="text-sm font-medium mb-1 flex items-center gap-3">
                <span>{id}: <span className="opacity-70">{Number(values[id] ?? 0).toFixed(2)}</span></span>
                <label className="ml-auto text-xs flex items-center gap-2">
                  <button className={"px-2 py-0.5 rounded border " + (autoPlay[id] ? "bg-green-50 border-green-400" : "")} title="Toggle auto (triangle wave)" onClick={() => {
                    setAutoPlay((prev) => { const next = { ...prev, [id]: !prev[id] }; if (!prev[id]) { setAutoStart((p) => ({ ...p, [id]: { t0: (performance?.now?.() ?? Date.now()), p0: 0 } })); } return next; });
                  }}>{autoPlay[id] ? "⏸ auto" : "▶ auto"}</button>
                  <span>|</span>
                  <input type="checkbox" className="mr-1" checked={!!interventions[id]} disabled={!!autoPlay[id]} onChange={(e) => setInterventions((prev) => ({ ...prev, [id]: e.target.checked }))} />
                  clamp (do)
                </label>
              </div>
              <input
              type="range"
              min={ranges[id]?.min ?? -100}
              max={ranges[id]?.max ?? 100}
              step={1}
              value={values[id] ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                const r = ranges[id] || { min: -100, max: 100 };
                const clamped = Math.min(r.max, Math.max(r.min, n));
                directChangedRef.current[id] = true; // seed propagation
                setValues((prev) => ({ ...prev, [id]: clamped }));
                // immediate visual feedback for the manipulated source only
                setDisplayValues((prev) => ({ ...prev, [id]: clamped }));
                if (autoPlay[id]) {
                  const y = (clamped - r.min) / (r.max - r.min || 1);
                  const p0 = Math.max(0, Math.min(1, y / 2));
                  setAutoStart((prev) => ({ ...prev, [id]: { t0: (performance?.now?.() ?? Date.now()), p0 } }));
                }
              }}
              onMouseDown={() => features.ephemeralClamp && setDragging((prev) => ({ ...prev, [id]: true }))}
              onMouseUp={(e) => {
                if (features.ephemeralClamp) setDragging((prev) => ({ ...prev, [id]: false }));
                // Final commit on drop to prevent stuck visuals
                const n = Number(e.currentTarget.value);
                const r = ranges[id] || { min: -100, max: 100 };
                const clamped = Math.min(r.max, Math.max(r.min, n));
                directChangedRef.current[id] = true;
                setValues((prev) => ({ ...prev, [id]: clamped }));
                setDisplayValues((prev) => ({ ...prev, [id]: clamped }));
              }}
              onMouseLeave={(e) => {
                if (features.ephemeralClamp) setDragging((prev) => ({ ...prev, [id]: false }));
                const n = Number(e.currentTarget.value);
                const r = ranges[id] || { min: -100, max: 100 };
                const clamped = Math.min(r.max, Math.max(r.min, n));
                directChangedRef.current[id] = true;
                setValues((prev) => ({ ...prev, [id]: clamped }));
                setDisplayValues((prev) => ({ ...prev, [id]: clamped }));
              }}
              onTouchStart={() => features.ephemeralClamp && setDragging((prev) => ({ ...prev, [id]: true }))}
              onTouchEnd={(e) => {
                if (features.ephemeralClamp) setDragging((prev) => ({ ...prev, [id]: false }));
                const n = Number(e.currentTarget.value);
                const r = ranges[id] || { min: -100, max: 100 };
                const clamped = Math.min(r.max, Math.max(r.min, n));
                directChangedRef.current[id] = true;
                setValues((prev) => ({ ...prev, [id]: clamped }));
                setDisplayValues((prev) => ({ ...prev, [id]: clamped }));
              }}
              onBlur={(e) => {
                const n = Number(e.currentTarget.value);
                const r = ranges[id] || { min: -100, max: 100 };
                const clamped = Math.min(r.max, Math.max(r.min, n));
                directChangedRef.current[id] = true;
                setValues((prev) => ({ ...prev, [id]: clamped }));
                setDisplayValues((prev) => ({ ...prev, [id]: clamped }));
              }}
            />
              <div className="flex gap-2 mt-1 items-center">
                <input type="number" className="w-28 border rounded px-2 py-1" min={ranges[id]?.min ?? -100} max={ranges[id]?.max ?? 100} step={1} value={values[id] ?? 0} onChange={(e) => {
                  const n = Number(e.target.value);
                  const r = ranges[id] || { min: -100, max: 100 };
                  const clamped = Math.min(r.max, Math.max(r.min, n));
                  directChangedRef.current[id] = true;
                  setValues((prev) => ({ ...prev, [id]: clamped }));
                  setDisplayValues((prev) => ({ ...prev, [id]: clamped }));
                }} />
                <span className="text-xs ml-2 opacity-70">range:</span>
                <input type="number" className="w-20 border rounded px-2 py-1" value={ranges[id]?.min ?? -100} onChange={(e) => {
                  const newMin = Number(e.target.value);
                  setRanges((prev) => { const r = prev[id] || { min: -100, max: 100 }; let min = newMin; let max = r.max; if (min >= max) max = min + 1; const next = { ...prev, [id]: { min, max } }; setValues((pv) => ({ ...pv, [id]: Math.min(max, Math.max(min, pv[id] ?? 0)) })); return next; });
                }} />
                <span>→</span>
                <input type="number" className="w-20 border rounded px-2 py-1" value={ranges[id]?.max ?? 100} onChange={(e) => {
                  const newMax = Number(e.target.value);
                  setRanges((prev) => { const r = prev[id] || { min: -100, max: 100 }; let max = newMax; let min = r.min; if (max <= min) min = max - 1; const next = { ...prev, [id]: { min, max } }; setValues((pv) => ({ ...pv, [id]: Math.min(max, Math.max(min, pv[id] ?? 0)) })); return next; });
                }} />
                <span className="text-xs ml-4 opacity-70">period (s):</span>
                <input type="number" className="w-20 border rounded px-2 py-1" min={0.1} step={0.1} value={autoPeriod[id] ?? 4} onChange={(e) => { const sec = Math.max(0.1, Number(e.target.value)); setAutoPeriod((prev) => ({ ...prev, [id]: sec })); }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-8">
        <style>{`@keyframes antsForward { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -24; } }`}</style>
        <div className="rounded-2xl shadow border h-[80vh] overflow-hidden">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}>
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default App;
import React, { useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import CircleNode from "./components/nodes/CircleNode.jsx";
import CausalEdge from "./components/edges/CausalEdge.jsx";
import DevPanel from "./components/panels/DevPanel.jsx";
import { DEFAULT_FEATURE_FLAGS } from "./components/constants.js";
import { PRESETS } from "./data/presets.js";
import { useScmModel } from "./hooks/useScmModel.js";
import { useNodeGraph } from "./hooks/useNodeGraph.js";
import { usePropagationEffects } from "./hooks/usePropagationEffects.js";

const defaultFeatures = { ...DEFAULT_FEATURE_FLAGS };

const nodeTypes = { circle: CircleNode };
const edgeTypes = { causal: CausalEdge };

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

  return (
    <div
      className="w-full h-full grid grid-cols-12 gap-4 p-4"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system" }}
    >
      <div className="col-span-4 space-y-4">
        <h1 className="text-3xl font-extrabold">Interactive DAG</h1>
        <DevPanel features={features} setFeatures={setFeatures} />

        <div className="rounded-2xl shadow p-4 border">
          <div className="text-lg font-bold mb-2">SCM</div>
          <div className="flex gap-2 mb-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                className="px-3 py-1 rounded-lg border"
                onClick={() => setScmText(preset.text)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <textarea
            className="w-full h-48 p-2 rounded-xl border"
            value={scmText}
            onChange={(e) => setScmText(e.target.value)}
          />
          <div className="text-xs text-gray-600 mt-2">
            Linear only. Example: <code>Med = 0.5*A</code>. Arrows point from RHS vars to LHS var.
          </div>
          {error && <div className="mt-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="rounded-2xl shadow p-4 border">
          <div className="text-lg font-bold mb-2">Assign Values (intervene)</div>
          {[...allVars].sort().map((id) => {
            const range = propagation.ranges[id] || { min: -100, max: 100 };
            const sliderValue = propagation.values[id] ?? 0;
            return (
              <div key={id} className="mb-4">
                <div className="text-sm font-medium mb-1 flex items-center gap-3">
                  <span>
                    {id}: <span className="opacity-70">{Number(sliderValue).toFixed(2)}</span>
                  </span>
                  <label className="ml-auto text-xs flex items-center gap-2">
                    <button
                      className={"px-2 py-0.5 rounded border " + (propagation.autoPlay[id] ? "bg-green-50 border-green-400" : "")}
                      title="Toggle auto (triangle wave)"
                      onClick={() => propagation.toggleAutoPlay(id)}
                    >
                      {propagation.autoPlay[id] ? "⏸ auto" : "▶ auto"}
                    </button>
                    <span>|</span>
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={!!propagation.interventions[id]}
                      disabled={!!propagation.autoPlay[id]}
                      onChange={(e) => propagation.setClamp(id, e.target.checked)}
                    />
                    clamp (do)
                  </label>
                </div>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={1}
                  value={sliderValue}
                  onChange={(e) => propagation.handleValueChange(id, Number(e.target.value))}
                  onMouseDown={() => startDrag(id)}
                  onMouseUp={(e) => finishDrag(id, Number(e.currentTarget.value))}
                  onMouseLeave={(e) => finishDrag(id, Number(e.currentTarget.value))}
                  onTouchStart={() => startDrag(id)}
                  onTouchEnd={(e) => finishDrag(id, Number(e.currentTarget.value))}
                  onBlur={(e) => finishDrag(id, Number(e.currentTarget.value))}
                />
                <div className="flex gap-2 mt-1 items-center">
                  <input
                    type="number"
                    className="w-28 border rounded px-2 py-1"
                    min={range.min}
                    max={range.max}
                    step={1}
                    value={sliderValue}
                    onChange={(e) => propagation.handleValueChange(id, Number(e.target.value))}
                  />
                  <span className="text-xs ml-2 opacity-70">range:</span>
                  <input
                    type="number"
                    className="w-20 border rounded px-2 py-1"
                    value={range.min}
                    onChange={(e) => propagation.handleRangeMinChange(id, Number(e.target.value))}
                  />
                  <span>→</span>
                  <input
                    type="number"
                    className="w-20 border rounded px-2 py-1"
                    value={range.max}
                    onChange={(e) => propagation.handleRangeMaxChange(id, Number(e.target.value))}
                  />
                  <span className="text-xs ml-4 opacity-70">period (s):</span>
                  <input
                    type="number"
                    className="w-20 border rounded px-2 py-1"
                    min={0.1}
                    step={0.1}
                    value={propagation.autoPeriod[id] ?? 4}
                    onChange={(e) => propagation.handleAutoPeriodChange(id, Number(e.target.value))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="col-span-8">
        <style>{`@keyframes antsForward { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -24; } }`}</style>
        <div className="rounded-2xl shadow border h-[80vh] overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
          >
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

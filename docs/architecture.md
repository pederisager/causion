# Architecture Overview

This document captures how the refactored DAG visual simulator is wired together so new contributors can navigate the modules, trace data flow, and keep the four core invariants healthy.

## Module boundaries at a glance
- **Graph parsing (`src/graph/`)** – `parseSCM` tokenises the SCM text with `jsep`, captures an AST plus dependency set for each assignment, and guarantees every mentioned variable has a model entry so downstream hooks can rely on total coverage.【F:src/graph/parser.js†L1-L113】
- **Dependency analysis (`src/graph/topology.js`)** – `depsFromModel` converts each AST-backed node into parent sets, while `topoSort` validates the DAG ordering before React Flow ever renders nodes.【F:src/graph/topology.js†L1-L62】
- **Stateful hooks (`src/hooks/`)** –
  - `useScmModel` owns the SCM text, reruns the parser/topology pipeline, and exposes a graph signature to trigger layout recalculation.【F:src/hooks/useScmModel.js†L1-L44】
  - `usePropagationEffects` drives value propagation, timers, clamps, autoplay, and marching-ants edge pulses from the parsed model.【F:src/hooks/usePropagationEffects.js†L1-L310】
  - `useNodeGraph` converts dependency sets and propagated values into React Flow node/edge objects, applying positions, handles, and arrow markers.【F:src/hooks/useNodeGraph.js†L1-L314】
- **Presentation (`src/components/`)** – React Flow nodes/edges and the developer control panel consume the prepared data coming from the hooks.【F:src/App.js†L1-L200】
- **Utilities & presets (`src/utils/`, `src/data/`)** – Shared helpers such as `buildGraphSignature`, timer scheduling, and the SCM preset catalogue keep logic centralised for both the UI and tests.【F:src/utils/graphSignature.js†L1-L16】【F:src/data/presets.js†L1-L20】

## DAG data flow (parser → hooks → React Flow)
```
SCM text (textarea / presets)
        │
        ▼
parseSCM → depsFromModel → topoSort  (graph/parser & graph/topology)
        │
        ▼
useScmModel  (stores text, exposes model, eqs, allVars, graphSignature)
        │
        ▼
usePropagationEffects  (computes values, schedules propagation + pulses)
        │
        ▼
useNodeGraph  (builds nodes/edges, applies visual state)
        │
        ▼
React Flow canvas (CircleNode + CausalEdge components)
```
- `useScmModel` feeds `model`, `eqs`, `allVars`, and a layout signature into the propagation and graph hooks whenever the SCM text or presets change.【F:src/App.js†L48-L67】
- `usePropagationEffects` maintains the authoritative values, clamp states, autoplay ranges, and heat maps; it schedules node value updates and edge pulses so the marching-ants animation reflects causal lag.【F:src/hooks/usePropagationEffects.js†L73-L310】
- `useNodeGraph` combines the dependency sets with the latest `displayValues`, `ranges`, and `edgeHot` maps to yield React Flow nodes/edges, reusing positions when the layout is in freeform mode and fitting the viewport after significant graph changes.【F:src/hooks/useNodeGraph.js†L112-L310】
- The top-level `CoreApp` component plugs the produced nodes/edges into React Flow, wires sliders to the propagation handlers, and passes feature flags (causal flow, ephemeral clamp, etc.) back into the hooks.【F:src/App.js†L43-L170】

## Key hooks & responsibilities
- **`useScmModel`**
  - Keeps the SCM editor’s text state and parses it on each change, surfacing friendly errors so the UI can highlight invalid models.【F:src/hooks/useScmModel.js†L12-L44】【F:src/App.js†L183-L200】
  - Generates a deterministic `graphSignature` that invalidates layouts when the dependency structure changes without losing user-driven node positions.【F:src/hooks/useScmModel.js†L15-L44】
- **`usePropagationEffects`**
  - Builds per-variable maps (`values`, `displayValues`, `ranges`, `interventions`) and keeps them aligned with the currently parsed variable set.【F:src/hooks/usePropagationEffects.js†L73-L205】
  - Coordinates autoplay (triangle wave), drag clamps, and slider commits while respecting feature flags for causal lag and ephemeral clamp resets.【F:src/hooks/usePropagationEffects.js†L207-L310】
  - Schedules edge pulses and node display updates, powering the marching-ants visuals and deterministic lag propagation.【F:src/hooks/usePropagationEffects.js†L239-L310】
- **`useNodeGraph`**
  - Projects the dependency map into node positions (grid layout by default, freeform when enabled) and ensures node data carries current min/max/value payloads.【F:src/hooks/useNodeGraph.js†L112-L196】
  - Regenerates edges with arrow markers, optional anchor handles, and hot-edge metadata consumed by the CausalEdge renderer.【F:src/hooks/useNodeGraph.js†L198-L286】
  - Triggers `reactFlow.fitView` when the graph signature changes so the canvas recentres after large topology edits.【F:src/hooks/useNodeGraph.js†L288-L303】

## Onboarding notes
### Run the project & tests
1. Install dependencies with `npm install` (CI uses the same command).【F:package.json†L1-L32】
2. Start the dev server via `npm run dev` to launch Vite with hot reload.
3. Execute the Node-based test suite with `npm test`; the repo uses the built-in test runner under the `tests/` directory.

### Add or tweak SCM presets
1. Open `src/data/presets.js` and append a new `{ key, label, text }` entry to the exported `PRESETS` array. Keep human-friendly labels so the preset buttons remain clear.【F:src/data/presets.js†L1-L14】
2. Optionally export a named constant for reuse in tests or docs (matching the existing `PRESET_*` pattern).【F:src/data/presets.js†L1-L12】
3. The preset immediately appears in the SCM panel buttons because `CoreApp` renders `PRESETS` directly; no extra wiring is required.【F:src/App.js†L48-L181】

### Manually verify the four core invariants
1. **Seeded causal lag propagation** – Enable the causal flow feature (Dev Panel) and adjust a source slider; downstream nodes update after the configured lag while `scheduleNodeDisplayUpdate` applies staged value commits.【F:src/hooks/usePropagationEffects.js†L239-L310】
2. **Immediate source updates** – Move any slider: `handleValueChange` writes straight into `values`/`displayValues`, so the dragged node reflects the new value without waiting for the propagation loop.【F:src/hooks/usePropagationEffects.js†L207-L310】
3. **Marching-ants edge animation** – Watch the affected edge when propagation runs; `scheduleEdgePulse` marks edges hot and `useNodeGraph` copies that state into React Flow edges for the CausalEdge renderer.【F:src/hooks/usePropagationEffects.js†L278-L295】【F:src/hooks/useNodeGraph.js†L198-L296】
4. **Ephemeral clamp behaviour** – Drag a slider with “ephemeral clamp” enabled: `CoreApp` notifies the hook on drag start/end and `usePropagationEffects` restores the unclamped value when the drag stops unless the “do()” checkbox is selected.【F:src/App.js†L69-L130】【F:src/hooks/usePropagationEffects.js†L312-L319】

These manual checks pair with the automated tests under `tests/` to guard the refactor. When validating changes, confirm each invariant still passes before opening a PR.

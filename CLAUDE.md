# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

| Topic | Command/Info |
|-------|-------------|
| Node & npm | Node ≥ 20, npm ≥ 10 (use npm, not yarn/pnpm) |
| Install | `npm ci` (preferred) or `npm install` |
| Dev server | `npm run dev` (Vite, usually http://localhost:5173) |
| Build | `npm run build` |
| Test | `npm test` (Vitest suite) or `npm run test:watch` |
| Test CI | `npm run test:ci` (full suite with Node specs) |
| Lint | `npm run lint` |
| Language | JavaScript only — do not introduce TypeScript |

## Architecture Overview

**Causion** is an interactive DAG visual simulation app (React + Vite) for exploring causal structure and "what-if" interventions.

### Tech Stack
- **React 19** + **Vite 7** — UI framework and build tool
- **React Flow** — DAG visualization and canvas
- **Zustand** — Lightweight state management for React Flow state
- **D3** — Data visualization (scatter plots)
- **jsep** — Expression parser for SCM equations
- **TailwindCSS** — Utility-first styling

### Data Flow Pipeline

```
SCM Text (textarea/presets)
    ↓
parseSCM → depsFromModel → topoSort (src/graph/)
    ↓
useScmModel (stores text, validates, exposes model/eqs/vars)
    ↓
usePropagationEffects (computes values, schedules propagation/pulses)
    ↓
useNodeGraph (builds React Flow nodes/edges with positions)
    ↓
React Flow Canvas (CircleNode + CausalEdge components)
```

### Key Modules

- **`src/graph/`** — DAG parsing and math (parser.js, topology.js, dagMath.js, interpreter.js)
- **`src/hooks/`** — React hooks (useScmModel, usePropagationEffects, useNodeGraph)
- **`src/components/`** — UI components (nodes/, edges/, panels/, layout/)
- **`src/store/`** — Zustand stores (useDagStore for node positions, feature flags)
- **`src/utils/`** — Helpers (graphSignature, timers, noiseUtils)
- **`src/data/presets.js`** — SCM preset definitions

## Core Invariants (Must Never Break)

1. **Deterministic SCM parsing & layout** — Parser surfaces friendly errors; layouts stay stable across edits
2. **Manual apply + seeded propagation** — Draft edits isolated until "Apply Changes"; DAG edits auto-commit; downstream nodes follow seeded lag schedule
3. **Clamps, ranges & baselines** — Ephemeral drag clamps release on pointer up, reverting to baseline unless `do()` enabled
4. **Automation exclusivity** — Auto slide and random play never run simultaneously for same variable
5. **Causal edge signaling** — Marching-ants pulses active when causal flow is on; respect `flowPulseMs`
6. **Data visualization sampling** — Scatter panel only records while active; wipes buffer when axes change
7. **Global noise injection** — Noise toggle injects Gaussian noise through `U_<var>` nodes without breaking DAG

## Coding Guidelines

- **React function components + hooks only**
- Keep code beginner-friendly with clear naming and inline comments for tricky logic
- Use pure functions for DAG math/transformations; isolate rendering from logic
- Do not introduce global state managers or routing libraries without approval
- Preserve public APIs and data contracts unless task explicitly requires refactoring

## Testing

- **Vitest + React Testing Library** — Default test stack
- Tests organized under `tests/components/` and `tests/integration/`
- Shared test utilities in `tests/setup/shared.js`
- Mock React Flow with `reactFlowBridgeStub`
- Prefer assertion-based behavior tests over snapshots
- Required regression test when modifying sliders: simulate drag + release and assert value/color reset

## Working Session Checklist

1. Clarify ambiguous requests before coding
2. Plan briefly: list targeted files, risks, and intended tests
3. **Feature preservation guardrail**: compare with previous commit; if removing features that weren't requested, stop and restore
4. Implement minimal change; avoid broad refactors
5. Run `npm test` before completing work
6. Smoke test UI: `npm run dev` → verify affected interactions
7. Update `BUG_LOG.md` when fixing bugs

## Related Documentation

- `README.md` — User guide and quick-start
- `docs/architecture.md` — Technical architecture details
- `docs/testing.md` — Test organization and invariant expectations
- `AGENTS.md` — Comprehensive agent guidelines (invariants, PR template, workflow)
- `BUG_LOG.md` — Bug tracking and regression checks

# AGENTS.md — DAG Visual Simulation App

> **Purpose**: Orient coding agents (e.g., OpenAI Codex) so they can ship small, safe, and well-tested updates to the DAG visual simulation app without endangering critical behaviors.

---

## 1. Quick reference (TL;DR)
| Topic | Required action |
| --- | --- |
| Node & npm | Node ≥ 20, npm ≥ 10 (use npm, not yarn/pnpm). |
| Install | `npm ci` (preferred) or `npm install`. |
| Dev server | `npm run dev` (Vite, usually http://localhost:5173). Announce any custom port in the logs. |
| Build | `npm run build`. |
| Tests | Prompt the user to run `npm test` (Vitest) or `npm run test:ci` and report results; agents cannot run Vitest in this sandbox. |
| Language | **JavaScript only** for new code. Do not introduce TypeScript. |
| UI stack | React + existing graph utilities; no heavy new deps without approval. |

---

## 2. Project overview
Interactive **DAG visual simulation app** (React + Vite) demonstrating causal flow. Last tagged stable snapshot: **causion_app_v1.0** (2025‑10‑12).

### Core invariants (must never regress)
1. **Deterministic SCM parsing & layout** – The SCM editor → parser → topology pipeline must surface friendly errors, emit nodes/edges for every referenced identifier, and keep layouts stable (freeform preserves manual coordinates; grid layout regenerates deterministically from `graphSignature`).
2. **Immediate + seeded propagation** – Local slider/number edits update the source display instantly while downstream nodes follow the seeded lag schedule (`features.causalLagMs`), producing reproducible timing and never skipping affected nodes.
3. **Clamps, ranges & baselines** – Ephemeral drag clamps release on pointer up, reverting to baseline unless `do()` is enabled; explicit clamps persist values, and slider/number/range inputs stay synchronized while auto-correcting invalid min/max pairs.
4. **Automation exclusivity** – Triangle‑wave auto slide and random play honor the current range, never run simultaneously for the same variable, and immediately relinquish control when a user clamps, intervenes, or commits a manual value.
5. **Causal edge signaling** – Marching‑ants pulses remain active when causal flow is on, respect `flowPulseMs`, and degrade gracefully to static straight edges when disabled; anchor handles stay aligned so arrows attach to the closest cardinal face.
6. **Data visualization sampling** – The floating scatter panel only records samples while “Visualize data” is active, wipes its buffer when axes change or inputs become invalid, and ignores NaN/non-changing pairs so plotted points reflect real propagation.

_Whenever core functionality changes in a way that affects expected behavior, update this invariants list (and the related guidance in AGENTS.md) as part of the same work._

If a change risks any invariant, stop, surface the concern, and mark the PR `needs-human-review`.

---

## 3. Environment & tooling
- Confirm local Node/npm meet minimum versions (see quick reference).
- Use any `.nvmrc` or `engines` hints if present.
- Prefer existing ESLint/Prettier settings; do not add heavy lint setups without direction.

---

## 4. Working session checklist
1. **Clarify the request**: ask follow-up questions when instructions seem ambiguous.
2. **Plan briefly**: list targeted files, risks, and intended tests before coding.
3. **Implement minimal change**: avoid broad refactors; keep code novice-friendly with helpful inline comments for non-obvious logic.
4. **Testing**:
   - Request that the user runs `npm test` (or `npm run test:ci` for the full suite) and share the results—Vitest does not execute inside this sandbox.
   - Add or update Vitest + React Testing Library specs when behavior changes.
   - Maintain (or add) a smoke test ensuring the app mounts without errors.
  - For slider interactions, ensure tests cover drag → release → auto-unclamp, plus “do()” persistence.
5. **Manual verification**:
   - `npm run dev`
   - Navigate to the affected UI
   - Verify sliders, propagation, marching-ants, auto slide vs random play toggles, and the “Visualize data” scatter logger all behave as expected.
6. **Self-check invariants** and document the confirmation in the PR.

---

## 5. Git workflow expectations
- Work from the branch specified in the task (default: current branch). Do not push to `main` directly.
- Branch naming:
  - Feature: `feat/<short-kebab-summary>`
  - Fix: `fix/<short-kebab-summary>`
  - Chore/Docs: `chore/<short-kebab-summary>`
- Commit messages: conventional-ish (e.g., `fix(slider): reset label on drop`).
- Every change requires a PR targeting `main`. Reference relevant tests and clearly state why the invariants remain safe.

### PR template (summarize per section)
1. **Title**: concise, action-oriented.
2. **Summary**
   - What changed
   - Why it matters
   - How to use it (if user-visible)
3. **Changes**: bullet per file explaining the edit.
4. **Behavior**
   - Before
   - After
5. **Testing**
   - Automated tests added/updated
   - Manual verification steps (detail the path in the UI)
6. **Regression Guard**: explicitly confirm all core invariants above.
7. **Follow-ups**: TODOs, tech debt, or next steps.

Tick the checklist items in the PR description:
- [ ] Requested the user to run `npm test` (or `npm run test:ci`) and recorded their results.
- [ ] Dev server smoke-tested for the affected path.
- [ ] No change to any core invariants listed in Section 2.
- [ ] New or updated tests cover the change.
- [ ] No large dependency introduced without justification.

---

## 6. Coding guidelines
- Stick to **React function components + hooks**.
- Keep code beginner-friendly: clear naming, small functions, inline comments for tricky logic.
- Use pure functions for DAG math/transformations; isolate rendering from logic when possible.
- Preserve public APIs and data contracts unless the task explicitly requires refactoring.
- Do **not** introduce global state managers or routing libraries without approval.

---

## 7. Tests & quality bars
- Vitest + React Testing Library are the default test stack; reuse utilities under `tests/` or `src/__tests__/`.
- `npm run test:ci` runs the Vitest suite plus the extra Node-based specs listed in `package.json`; ask the user to run it when full coverage is required since Vitest cannot run in this sandbox.
- Required regression test when modifying sliders: simulate drag + release and assert value/color reset (unless clamped).
- Keep snapshot tests minimal; prefer assertion-based behavior tests.
- For asynchronous animations (e.g., marching-ants), consider deterministic timers or helper utils if flakes appear—submit those helpers in a focused PR first.

---

## 8. Repository structure (guide only)
- `src/`
  - `App.js` / `main.jsx` — app entry + React Flow wiring.
  - `components/` — nodes, edges, DevPanel, slider stack, and the DataVisualizationPanel overlay.
  - `hooks/` — `useScmModel`, `usePropagationEffects`, `useNodeGraph`, and supporting logic.
  - `graph/` — SCM parsing, topology, and math helpers.
  - `data/` — presets, waveform helpers, and other shared constants.
  - `utils/` — timers, graph signature helpers, node/edge mutators.
  - `assets/`, `theme.cjs`, `theme.css`, `App.css`, `index.css` — styling, theming, and static resources.
- `tests/` — Vitest + Node suites plus `tests/setup/` for React Flow harnesses.
- `public/` — static assets served by Vite.
- `docs/` — supplementary documentation (architecture, testing, assets).
- Root configs (`package.json`, `vite.config.js`, `vitest.config.js`, etc.) — scripts and tooling metadata.

Update this document via a dedicated `docs:` PR if the structure materially changes.

---

## 9. CI guidance
If `/.github/workflows/ci.yml` is missing, add a minimal workflow:
```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci || npm install
      - run: npm run test:ci
```
Because Vitest cannot run inside the Codex sandbox, agents must request that the user runs `npm run test:ci` locally whenever a CI-equivalent verification is required.

---

## 10. Security & data policy
- No secrets required to run locally. If you add tooling needing secrets, document it here and rely on GitHub encrypted secrets.
- Do not exfiltrate code or proprietary data outside approved PRs.

---

## 11. When to escalate
- Changes that touch DAG propagation internals or threaten any core invariant → open a draft PR and request human review early.
- If drag/drop timing proves flaky, propose deterministic test utilities in a separate preliminary PR before tackling the main change.

---

Make sure to use use timeout <seconds> <cmd> with a sensible second count for running commands to avoid getting stuck. 

*End of AGENTS.md*


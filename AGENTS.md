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
| Tests | `npm test` (Vitest). Add/maintain tests for every fix/feature. |
| Language | **JavaScript only** for new code. Do not introduce TypeScript. |
| UI stack | React + existing graph utilities; no heavy new deps without approval. |

---

## 2. Project overview
Interactive **DAG visual simulation app** (React + Vite) demonstrating causal flow. Last tagged stable snapshot: **causion_app_v1.0** (2025‑10‑12).

### Four invariants (must never regress)
1. **Seeded causal lag propagation remains deterministic.**
2. **Immediate source updates**: upstream node changes appear instantly.
3. **Marching‑ants edge animation** stays active and visually consistent.
4. **Ephemeral clamp on drag**: dragging a slider temporarily clamps; releasing returns value + color/label to baseline unless “do()” is selected.

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
   - Run `npm test`.
   - Add or update Vitest + React Testing Library specs when behavior changes.
   - Maintain (or add) a smoke test ensuring the app mounts without errors.
  - For slider interactions, ensure tests cover drag → release → auto-unclamp, plus “do()” persistence.
5. **Manual verification**:
   - `npm run dev`
   - Navigate to the affected UI
   - Verify sliders, propagation, and marching-ants behaviors remain intact.
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
6. **Regression Guard**: explicitly confirm all four invariants above.
7. **Follow-ups**: TODOs, tech debt, or next steps.

Tick the checklist items in the PR description:
- [ ] `npm test` passes locally.
- [ ] Dev server smoke-tested for the affected path.
- [ ] No change to: seeded propagation / immediate updates / marching-ants / ephemeral clamp.
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
- Required regression test when modifying sliders: simulate drag + release and assert value/color reset (unless clamped).
- Keep snapshot tests minimal; prefer assertion-based behavior tests.
- For asynchronous animations (e.g., marching-ants), consider deterministic timers or helper utils if flakes appear—submit those helpers in a focused PR first.

---

## 8. Repository structure (guide only)
- `src/`
  - `components/` — UI elements (sliders, nodes, controls)
  - `graph/` — DAG data & propagation utilities
  - `state/` — shared state helpers
  - `styles/` — CSS/animation assets (marching-ants)
- `tests/` or `src/__tests__/` — Vitest suites
- `public/` — static assets
- `docs/` — supplementary documentation
- `package.json` — scripts & metadata

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
      - run: npm test
```

---

## 10. Security & data policy
- No secrets required to run locally. If you add tooling needing secrets, document it here and rely on GitHub encrypted secrets.
- Do not exfiltrate code or proprietary data outside approved PRs.

---

## 11. When to escalate
- Changes that touch DAG propagation internals or threaten the four invariants → open a draft PR and request human review early.
- If drag/drop timing proves flaky, propose deterministic test utilities in a separate preliminary PR before tackling the main change.

---

Make sure to use use timeout <seconds> <cmd> with a sensible second count for running commands to avoid getting stuck. 

*End of AGENTS.md*


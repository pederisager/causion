# AGENTS.md — DAG Visual Simulation App

> **Purpose**: This file tells coding agents (e.g., OpenAI Codex) exactly how to work in this repository—how to run, test, and propose changes without breaking our core behaviors.

---

## Project overview
An interactive **DAG visual simulation app** (React) used to demonstrate causal flow. The current **last stable version** as of **2025‑10‑12** is named:

**causion_app_v1.0**

### Core behaviors that must never regress
- **Correct seeded causal lag propagation**
- **Immediate source updates**
- **Marching‑ants edge animation**
- **Ephemeral clamp while dragging + slider drop sync fix** (no “stuck” bug): when a slider is released, the manipulated variable’s value **and color/label reset to zero** unless “Clamp (do)” is explicitly chosen.

If any change risks these, **abort**, open a discussion, and label the PR `needs-human-review`.

---

## System requirements
- Node.js **>= 20**
- npm **>= 10** (use npm for consistency unless instructed otherwise)
- OS: macOS/Linux/Windows

> If the repo contains an `.nvmrc` or `engines` in `package.json`, prefer those.

---

## Install, run, test

### Install
```bash
npm ci || npm install
```

### Development server
```bash
npm run dev
```
- The server should start on a local port (commonly 5173/3000). If the port is busy, pick another and **print the chosen URL in logs**.

### Build
```bash
npm run build
```

### Tests
We aim for lightweight **unit/integration tests**. Use what the repo already has. If **no framework exists**, set up:
- **Vitest** + **@testing-library/react** for component/integration tests.
- Optional E2E: **Playwright** (headless) for UI flows involving drag/drop.

Run tests:
```bash
npm test
```

**Required test (must pass before merging):**
1) **Slider drop reset**: Simulate dragging a variable’s slider to a non‑zero value, then releasing. Expect the variable’s **numeric label and color** to return to baseline (zero) **unless** the “Clamp (do)” control is active. Also confirm marching‑ants animation remains active/unaffected.

If tests don’t exist yet, create them under `tests/` or `src/__tests__/` and wire `npm test` accordingly.

---

## Repository etiquette for agents

### Branching & tags
- Protected branches: `main`
- Stable snapshot tag for rollback: `stable/2025-10-12-causal-flow`
- Branch names:
  - Features: `feat/<short-kebab-summary>`
  - Fixes: `fix/<short-kebab-summary>`
  - Chore/docs: `chore/<short-kebab-summary>`

### Commits & PRs
- Commit style: conventional-ish messages (e.g., `fix(slider): reset label and color on drop`).
- Always open a **PR** to `main`; do **not** push directly.
- Link to tests in the PR description and summarize **why** the change is safe for the four core behaviors above.
- Add label(s): `feat` / `bug` / `refactor` / `tests` / `docs` as appropriate.

**PR checklist (agent must tick in description):**
- [ ] I ran `npm test` locally and all tests pass.
- [ ] I manually smoke‑tested the dev server for the affected feature.
- [ ] The change **does not** alter:
  - [ ] seeded causal lag propagation
  - [ ] immediate source updates
  - [ ] marching‑ants animation
  - [ ] ephemeral clamp + slider drop sync behavior
- [ ] Added/updated tests cover the change.
- [ ] No large dependency added without justification.

---

## Coding standards
- Prefer **TypeScript** if the file already uses it; otherwise plain JS is fine. Do **not** convert entire files to TS unless the task requests it.
- Keep functions small; favor pure logic for DAG updates, with clear separation from UI rendering.
- Preserve existing public props and data contracts between components unless the task explicitly includes a refactor.
- If ESLint/Prettier are configured, run them. Otherwise, do not introduce heavy lint setups without approval.

---

## Files & structure (typical; adjust to repo)
- `src/` — React source
  - `graph/` — DAG data structures & propagation logic
  - `components/` — UI components (sliders, nodes, edges)
  - `styles/` — CSS/animation (marching‑ants)
  - `state/` — app state (e.g., store, reducers)
- `tests/` or `src/__tests__/` — unit/integration tests
- `public/` — static assets
- `package.json` — scripts

> If paths differ, **infer from code** and update this document in a separate `docs:` PR.

---

## Minimal CI (if none exists)
If `/.github/workflows/ci.yml` is absent, open a PR adding this workflow:
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

## Security & data
- This project has **no secret keys** required to run. If an agent adds tooling needing secrets, use GitHub Encrypted Secrets and update this file.
- Do not exfiltrate code outside the PR.

---

## When to stop and ask for review
- If a change touches DAG propagation logic or any of the four protected behaviors, open a **draft PR** early and request human feedback.
- If tests reveal non‑deterministic timing in drag/drop, propose a small test util (e.g., fake timers or deterministic animation frame) **in a separate PR** before main changes.

---

*End of AGENTS.md*


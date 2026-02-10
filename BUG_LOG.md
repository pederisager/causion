# Bug Log — DAG Visual Simulation App

Purpose: keep a running record of all bugs caught and fixed so regressions are easier to spot.

How to use:
- Append a new entry whenever a bug is fixed (even small ones).
- Include a commit hash or PR link if available; otherwise mark as "uncommitted".
- Note the regression checks and tests that confirm the fix.

## Format (copy for each entry)
## YYYY-MM-DD — Short title
- Area:
- Symptom:
- Root cause:
- Fix:
- Tests:
- Regression check:
- Commit/PR:

## Entries
## 2026-01-14 — align edge endpoints to node borders
- Area: DAG panel / edge layout
- Symptom: Edge lines and arrowheads left a visible gap before touching node borders.
- Root cause: Right/bottom handle transforms pushed connection anchors outside the node perimeter.
- Fix: Recenter right/bottom handles on the node border so edge endpoints land flush.
- Tests: Not run (Vitest not executed in this environment).
- Regression check: Pending manual smoke pass (verify edges touch node borders on all sides).
- Commit/PR: uncommitted

## 2026-02-10 â€” fix(export): align DAG image download with rendered graph
- Area: DAG image export
- Symptom: Exported images used wide borders, default brown edges, missing control hatching/edge styling, and non-transparent backgrounds.
- Root cause: Export path rebuilt a synthetic SVG with hard-coded palette and padding instead of capturing the rendered React Flow viewport.
- Fix: Switched export to clone the live `.react-flow__viewport`, inline computed styles, crop to tight node bounds, and rasterize with transparent canvas background.
- Tests: Updated `tests/components/App.test.js` mock expectations and added `tests/components/dagImageExport.test.js` bounds/filename coverage.
- Regression check: Playwright smoke verified the download button still emits a PNG file end-to-end.
- Commit/PR: uncommitted.

## 2026-02-10 â€” fix(export-ui): improve PNG resolution and move download control
- Area: DAG image export / canvas controls
- Symptom: Exported PNG clarity was lower than desired, and the download action was less discoverable in the header controls row.
- Root cause: Export scaling capped at low resolution and button placement was detached from DAG interaction controls.
- Fix: Increased rasterization scale/canvas cap for higher-resolution PNG output and moved the download button into the DAG canvas overlay near the zoom/fit/interactivity controls (lower-left on desktop).
- Tests: Updated `tests/components/App.test.js` to assert canvas-anchored button placement and kept download invocation coverage.
- Regression check: Targeted Vitest, production build, and Playwright export smoke all pass.
- Commit/PR: uncommitted.

## 2026-01-14 - separate handle arrow length from edge gap
- Area: DAG panel / node handle styling
- Symptom: Handle arrows drifted off-center and changing the gap did not move edge endpoints.
- Root cause: Handle transforms coupled arrow length to the gap, and React Flow edges ignored CSS-transformed handle positions.
- Fix: Keep handle positions fixed to the node, drive arrow length solely from `--node-handle-arrow-length`, and shorten edge endpoints in `CausalEdge` using `--edge-connection-gap`.
- Tests: Not run (Vitest not executed in this environment).
- Regression check: Pending manual smoke pass (select node, tweak `--node-handle-arrow-length` and `--edge-connection-gap`, verify arrows stay centered and edge endpoints move).
- Commit/PR: uncommitted

## 2026-01-14 - preserve derived nodes on edge delete
- Area: DAG edges / SCM mutation
- Symptom: Deleting an edge removed the parent node when it only existed on the RHS.
- Root cause: removeEdgeFromScm updated the child expression but left parent-only identifiers without an explicit assignment, so parseSCM dropped them.
- Fix: After removing an edge, append `parent = 0` when the parent has no assignment and no remaining references.
- Tests: Not run (Vitest not executed in this environment). Added coverage in `tests/graph/scmMutations.test.js`.
- Regression check: Pending manual smoke pass (delete edge; parent remains).
- Commit/PR: uncommitted

## 2026-01-14 — flip DAG edge handle arrows outward
- Area: DAG panel / node handles
- Symptom: Source handle arrows pointed inward toward the selected node.
- Root cause: Base clip-path triangle pointed left, so handle rotations aimed into the node.
- Fix: Flip the handle arrow clip-path so the default triangle points outward.
- Tests: Not run (Vitest not executed in this environment).
- Regression check: Pending manual smoke pass (select node, verify handle arrows point away from node).
- Commit/PR: uncommitted

## 2026-01-14 - restore phone DAG layout when data panel is closed
- Area: Phone layout / Dock layout
- Symptom: On phones the DAG canvas disappears; closing the data panel leaves a blank screen.
- Root cause: Overlay DockLayout did not use flex layout so the primary pane had no height; portrait CSS forced a 50/50 split even when no panels were shown.
- Fix: Keep DockLayout flex in overlay mode and only apply the portrait 50/50 split when phone panels are present.
- Tests: Not run (Vitest not executed in this environment). Added coverage in `tests/components/App.phone-flow.test.js`.
- Regression check: Pending manual smoke pass (phone layout).
- Commit/PR: uncommitted

## 2026-01-14 - improve edge handles + edge deletion
- Area: DAG edges / connection UX
- Symptom: Source handles were clipped/invisible and required precise hits on target handles; deleting an edge via the keyboard was not supported.
- Root cause: Node overflow clipped outward handles, and there was no target-sized handle to accept drops across the node; no SCM mutation existed for edge removal.
- Fix: Allow overflow when connection handles are active, add an invisible target-area handle for drop-anywhere targeting while keeping connect starts on source arrows only, expand edge click hit-area, show formulas on selected edges, and add SCM edge removal on Delete.
- Tests: Not run (Vitest not executed in this environment). Updated `tests/components/CausalEdge.test.js` and `tests/graph/scmMutations.test.js`.
- Regression check: Pending manual smoke pass (npm run dev, connect nodes, select edge, Delete).
- Commit/PR: uncommitted

## 2026-01-14 - avoid Vite cache lock in Dropbox
- Area: Dev server / Vite cache
- Symptom: npm run dev fails with EBUSY rename errors in node_modules/.vite during dependency updates.
- Root cause: Vite cache directory inside a Dropbox-synced folder is locked during rename.
- Fix: Move Vite cacheDir to the OS temp directory so Dropbox does not lock it.
- Tests: Not run (Vitest not executed in this environment).
- Regression check: Pending manual smoke pass (npm run dev).
- Commit/PR: uncommitted

## 2026-01-14 — preserve RHS-only parents on DAG delete
- Area: SCM mutations / DAG delete
- Symptom: Deleting a node removed parent-only variables that were referenced only on RHS (e.g., deleting M also removed X).
- Root cause: `removeNodeFromScm` removed the child assignment, leaving parent-only symbols with no explicit definition so they vanished from the parsed model.
- Fix: When deleting a node, detect dependencies that would disappear and append `name = 0` stubs to keep them explicit.
- Tests: Not run (Vitest not executed in this environment). Added coverage in `tests/graph/scmMutations.test.js`.
- Regression check: Pending manual smoke pass.
- Commit/PR: uncommitted

## 2026-01-14 — fix data panel close + resizer visibility
- Area: Data panel / Dock layout
- Symptom: Close button appeared to do nothing; data panel could not be resized in docked views.
- Root cause: `hidden` was overridden by Tailwind display utilities, so the panel stayed visible while `isOpen` was false (resizer handle was removed).
- Fix: Hide the docked panel via inline `display: none` when closed, pause sampling when the panel is closed, and label the resizer handle; add DockLayout coverage.
- Tests: Not run (Vitest not executed in this environment).
- Regression check: Pending manual smoke pass.
- Commit/PR: uncommitted

## 2025-11-15 — fixed Apply Changes button position in Phone Layout
- Area: Unspecified (see commit subject)
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fixed Apply Changes button position in Phone Layout
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: a56779e

## 2025-11-01 — fixed DAG default positioning
- Area: Unspecified (see commit subject)
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fixed DAG default positioning
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: b485860

## 2025-10-25 — fixed failing timers test
- Area: Unspecified (see commit subject)
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fixed failing timers test
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: 7ca9817

## 2025-10-25 — fix node failure to reset bug
- Area: Unspecified (see commit subject)
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fix node failure to reset bug
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: c1aa61e

## 2025-10-25 — Fixed SCM panel explainer text
- Area: Unspecified (see commit subject)
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: Fixed SCM panel explainer text
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: eebd877

## 2025-10-23 — fixed bug DAG not resetting after slide/random
- Area: Unspecified (see commit subject)
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fixed bug DAG not resetting after slide/random
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: 66e6a38

## 2025-10-21 — changed default causalLagMs value to harmonize with fix to the inaccurate value bug
- Area: Unspecified (see commit subject)
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: changed default causalLagMs value to harmonize with fix to the inaccurate value bug
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: e16ba5b

## 2025-10-21 — fix(timers): queue pending propagation updates
- Area: timers
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fix(timers): queue pending propagation updates
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: 01bdf54

## 2025-10-21 — fix(timers): let propagation timers finish firing
- Area: timers
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fix(timers): let propagation timers finish firing
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: 6c137da

## 2025-10-20 — fix(propagation): refresh downstream timers with latest values
- Area: propagation
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fix(propagation): refresh downstream timers with latest values
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: 04b0e64

## 2025-10-20 — fix(propagation): preserve hoisted source values
- Area: propagation
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fix(propagation): preserve hoisted source values
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: 1e65a4d

## 2025-10-20 — fix(timers): clear stale node display timers
- Area: timers
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fix(timers): clear stale node display timers
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: aad4eb1

## 2025-10-19 — fix(propagation): stream queued causal updates
- Area: propagation
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fix(propagation): stream queued causal updates
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: dadb939

## 2025-10-19 — fix(flow): stabilise dag updates under rapid changes
- Area: flow
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fix(flow): stabilise dag updates under rapid changes
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: 1a147bd

## 2025-10-19 — fix(flow): avoid repeated fitView thrash
- Area: flow
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fix(flow): avoid repeated fitView thrash
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: 723ba86

## 2025-10-19 — fixed app rendering so DAG now displays. App renders as expected.
- Area: Unspecified (see commit subject)
- Symptom: See commit subject.
- Root cause: Not recorded in commit message.
- Fix: fixed app rendering so DAG now displays. App renders as expected.
- Tests: Not recorded.
- Regression check: Not recorded.
- Commit/PR: 91e0894

## 2026-01-14 — fix(phone-ui): show data panel under DAG in phone layout
- Area: phone UI / data panel layout
- Symptom: "Visualize data" button not accessible on phone; data panel could not be viewed.
- Root cause: Phone layout forced data panel to overlay mode and the toggle lived in the advanced panel, which is often hidden.
- Fix: Force bottom docking in phone layout and surface the toggle in the phone header.
- Tests: Not run (sandbox).
- Regression check: Not run (needs manual smoke in phone layout).
- Commit/PR: Not committed.

## 2026-01-15 — nodes disappear after editing edge formulas
- Area: DAG panel / SCM mutations / edge editing
- Symptom: Creating a new node and then editing an edge formula causes the new node to disappear from both the DAG and SCM. Sometimes affects newly created edges as well. Intermittent behavior.
- Root cause: Stale closure in `handleEdgeCoefficientCommit` and other DAG mutation callbacks. When user performs rapid actions (e.g., creates node, immediately edits edge), React's state update hasn't propagated yet, so `appliedScmText` in the callback closure contains old SCM text without the newly created node. Subsequent `upsertEdgeCoefficient` call uses this stale text and overwrites the committed state, losing the new node.
- Fix: Store `appliedScmText` in a ref (`appliedScmTextRef`) that's kept in sync via `useEffect`. Update all DAG mutation callbacks (`handleEdgeCoefficientCommit`, `handleRenameCommit`, `handleCreateNode`, `handleConnect`, `handleDeleteSelectedEdge`, `handleDeleteSelectedNode`) to read from `appliedScmTextRef.current` instead of using the closure value. This ensures mutations always operate on the most current SCM text.
- Tests: Added `tests/integration/edge-edit-preserves-nodes.test.js` to verify nodes are preserved after edge edits. All existing tests pass (10 pass, 1 pre-existing failure unrelated to this fix).
- Regression check: Manual testing should verify: (1) create node, immediately edit edge formula → node persists; (2) create edge, edit existing edge → both edges persist; (3) rename node, edit edge → both actions succeed.
- Commit/PR: uncommitted

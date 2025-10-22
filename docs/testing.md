# Testing Guide

This document explains how to run the automated test suites for the Causion app, how the test files are organized, and which invariants every contributor must verify before shipping changes.

## Test runners & commands

We use **Vitest** together with **@testing-library/react**. All commands below should be run from the repository root after installing dependencies with `npm install`.

- `npm test` – Executes the full Vitest suite once in watchless (CI-friendly) mode.
- `npm run test:watch` – Starts Vitest in watch mode so tests rerun automatically as you edit files.
- `npm run test:ci` – Alias for the CI configuration (if defined) that runs the same suite as `npm test`.

> Tip for beginners: You can stop any command by pressing `Ctrl + C` (`Cmd + C` on macOS) in the terminal window.

## Folder layout

Test files live in the top-level `tests/` directory. Within that folder we group specs by scope so it’s easy to find the right place for new coverage:

- `tests/components/` – Component-level tests that render individual React components with React Testing Library.
- `tests/integration/` – Broader flows that combine multiple components or simulate user interactions.
- `tests/utils/` – Pure function and helper utilities.
- `tests/fixtures/` – Reusable mock data or helper factories shared across suites.

If you are adding a new file and aren’t sure where it belongs, pick the folder whose description matches your test’s goal and mirror the existing naming style.

## Required invariant checks

Every change must preserve the four core behaviors that define the Causion experience. Whether you are adding code or updating documentation, run through this checklist (manually or via automated tests where applicable):

1. **Seeded causal lag propagation** still produces deterministic, reproducible animation timing.
2. **Immediate source updates** keep dependent nodes in sync as soon as a source node changes.
3. **Marching-ants edge animation** remains visible and responsive on causal links.
4. **Ephemeral clamp behavior** ensures that dragging a slider clamps temporarily, and releasing it resets the value unless “do()” is enabled.

Document in your pull request how you verified these invariants—via automated coverage, manual testing, or both.

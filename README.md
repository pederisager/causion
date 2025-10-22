# Causion

**Causion** is an interactive DAG (Directed Acyclic Graph) visual simulation app for exploring causal structure and “what‑if” interventions. It’s built for teaching, demos, and quick experiments—no heavy setup required.

> Latest stable (2025‑10‑12): **Dag App — Causal Flow (marching Ants, Restored Features)**

## What it does
- **Draw & edit DAGs**: Add variables (nodes), connect them with edges, and rearrange freely.
- **Causal flow animation**: “Marching‑ants” animated edges show direction of effect propagation.
- **Seeded causal lag**: Updates propagate with a consistent, reproducible lag to make sequences visible.
- **Immediate source updates**: Source node changes update dependents without extra clicks.
- **Ephemeral clamp while dragging**: Dragging a slider temporarily clamps a variable; on release it **resets to baseline** unless “do()” is explicitly enabled (fixes the classic “stuck after drop” bug).

## Why use Causion?
- **See** how interventions ripple through a causal graph.
- **Teach** counterfactuals, mediation, and confounding with live visuals.
- **Prototype** ideas quickly before formal modeling.

## Project status
Causion is under active development. The focus is stability of the four core behaviors above while we expand testing and quality‑of‑life features.

## Directory structure (quick tour)
Once the app is installed you will see these key folders:

- `src/` – all source code for the React app.
  - `src/App.jsx` – entry UI that wires together the panels and canvas.
  - `src/components/` – reusable UI pieces such as panels, nodes, and edges.
  - `src/data/presets.js` – shared SCM preset strings and helper math utilities (e.g., the triangular autoplay waveform).
  - `src/graph/` – parsing and math helpers for structural causal models.
  - `src/hooks/` – React hooks that manage state, propagation, and graph coordination.
  - `src/utils/` – browser-friendly utilities (timers, formatting, etc.).
- `tests/` – Node-based unit tests that exercise parsers, hooks, and presets.

## Contributing
Pull requests are welcome. Please preserve the core behaviors and include tests for UI changes where feasible.

## Run it locally (quick-start)
Follow these beginner-friendly steps to try the app on your computer:

1. **Install Node.js** (version 20 or newer). The easiest path is to download the installer from [nodejs.org](https://nodejs.org/) and run it with the default options.
2. **Download the project**.
   - If you use GitHub, click the green **Code** button and choose **Download ZIP**.
   - After the download finishes, unzip the folder to a place you can find (for example, your Desktop).
3. **Open a terminal** (macOS: Spotlight → “Terminal”; Windows: Start menu → “Command Prompt” or “PowerShell”).
4. **Go to the project folder** you unzipped. Example command (replace the path with your own):
   ```bash
   cd path/to/causion-app
   ```
5. **Install the app’s packages**. This step downloads everything the app needs:
   ```bash
   npm install
   ```
   > The first run may take a few minutes while files download.
6. **Start the app**:
   ```bash
   npm run dev
   ```
   - The terminal will show a local web address such as `http://localhost:5173/`.
7. **Open the app in your browser** by typing that address into Chrome, Edge, or Firefox. You should now see the DAG simulation and can experiment with the sliders and nodes.
8. **Stop the app** when you are done by returning to the terminal window and pressing `Ctrl + C` (or `Cmd + C` on macOS).

## Testing
Curious how we keep the four core behaviors stable? Read the detailed [Testing Guide](docs/testing.md) for background, folder layout, and invariant expectations. When you are ready to run the suites yourself:

- `npm test` – runs the full Vitest suite once (the same command used in CI).
- `npm run test:watch` – reruns tests automatically as you edit files.
- `npm run test:ci` – alternate entry point for automated pipelines when defined.

Invariant-focused checks (such as the slider clamp flow) live alongside our integration specs—for example, see `tests/integration/SliderClamp.test.js`.

## License
This project is dedicated to the public domain under the [Creative Commons CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) license.

To the extent possible under law, the contributors have waived all copyright and related or neighboring rights to this work. You can copy, modify, distribute, and perform the work, even for commercial purposes, all without asking permission.

# Causion

**Causion** is an interactive DAG (Directed Acyclic Graph) visual simulation app for exploring causal structure and “what‑if” interventions. It’s built for teaching, demos, and quick experiments—no heavy setup required.

> Latest stable (2025‑10‑12): **Dag App — Causal Flow (marching Ants, Restored Features)**

## What it does
- **Draw & edit DAGs**: Add variables (nodes), connect them with edges, and rearrange freely.
- **Causal flow animation**: “Marching‑ants” animated edges show direction of effect propagation.
- **Seeded causal lag**: Updates propagate with a consistent, reproducible lag to make sequences visible.
- **Immediate source updates**: Source node changes update dependents without extra clicks.
- **Ephemeral clamp while dragging**: Dragging a slider temporarily clamps a variable; on release it **resets to baseline** unless “Clamp (do)” is explicitly enabled (fixes the classic “stuck after drop” bug).

## Why use Causion?
- **See** how interventions ripple through a causal graph.
- **Teach** counterfactuals, mediation, and confounding with live visuals.
- **Prototype** ideas quickly before formal modeling.

## Project status
Causion is under active development. The focus is stability of the four core behaviors above while we expand testing and quality‑of‑life features.

## Contributing
Pull requests are welcome. Please preserve the core behaviors and include tests for UI changes where feasible.

## License
TBD.

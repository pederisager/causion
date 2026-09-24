# Issue #39 prototype

Question: Does showing every supported SCM function beneath the editor help enough to justify the extra UI?

Run `npm run prototype:39` and open the displayed local URL. The SCM editor opens by default in prototype mode. Switch between `?variant=A`, `?variant=B`, and `?variant=C` with the floating bar or left/right arrow keys.

- A shows all five equations at once as an inline list.
- B shows one selected function and a short note.
- C keeps the examples hidden until the guide is opened.

The examples are read-only and exist only in Vite's `prototype` mode. Standard development and production builds keep the current UI. Verdict: pending user review.

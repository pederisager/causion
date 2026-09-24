import React, { useCallback, useEffect, useState } from "react";

// PROTOTYPE for #39: compare three ways to show the five supported functions
// directly below the existing SCM editor. These examples never edit the SCM.
const examples = [
  { name: "abs", equation: "Y = abs(X)", note: "Absolute value" },
  { name: "sin", equation: "Y = sin(X)", note: "Sine; X is in radians" },
  { name: "cos", equation: "Y = cos(X)", note: "Cosine; X is in radians" },
  { name: "log", equation: "Y = log(X + 1)", note: "Natural log; input must be positive" },
  { name: "exp", equation: "Y = exp(X)", note: "Exponential" },
];

const variants = [
  { key: "A", name: "Inline list" },
  { key: "B", name: "Picker" },
  { key: "C", name: "Collapsed guide" },
];

function readVariant() {
  const key = new URLSearchParams(window.location.search).get("variant");
  return variants.some((item) => item.key === key) ? key : "A";
}

function InlineList() {
  return (
    <div className="scm-prototype scm-prototype--inline" aria-label="Function examples">
      <strong>Function examples</strong>
      <div className="scm-prototype__chips">
        {examples.map((item) => (
          <code key={item.name} title={item.note}>{item.equation}</code>
        ))}
      </div>
    </div>
  );
}

function Picker() {
  const [selected, setSelected] = useState(examples[0]);
  return (
    <div className="scm-prototype scm-prototype--picker">
      <label htmlFor="scm-prototype-function">Example for</label>
      <select
        id="scm-prototype-function"
        value={selected.name}
        onChange={(event) => setSelected(examples.find((item) => item.name === event.target.value))}
      >
        {examples.map((item) => <option key={item.name} value={item.name}>{item.name}()</option>)}
      </select>
      <code>{selected.equation}</code>
      <small>{selected.note}</small>
    </div>
  );
}

function CollapsedGuide() {
  return (
    <details className="scm-prototype scm-prototype--guide">
      <summary>Show five function examples</summary>
      <ul>
        {examples.map((item) => (
          <li key={item.name}>
            <code>{item.equation}</code>
            <span>{item.note}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function ScmExamplesPrototype() {
  const [variant, setVariant] = useState(readVariant);

  useEffect(() => {
    const syncFromUrl = () => setVariant(readVariant());
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const selectVariant = useCallback((key) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", key);
    window.history.replaceState(null, "", url);
    setVariant(key);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      const index = variants.findIndex((item) => item.key === variant);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      selectVariant(variants[(index + direction + variants.length) % variants.length].key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant, selectVariant]);

  const current = variants.find((item) => item.key === variant);
  return (
    <>
      {variant === "A" && <InlineList />}
      {variant === "B" && <Picker />}
      {variant === "C" && <CollapsedGuide />}
      <div className="scm-prototype-switcher" aria-label="Issue 39 prototype variants">
        <span>PROTOTYPE #39</span>
        <button type="button" aria-label="Previous prototype" onClick={() => selectVariant(variants[(variants.indexOf(current) + variants.length - 1) % variants.length].key)}>←</button>
        <strong>{current.key} · {current.name}</strong>
        <button type="button" aria-label="Next prototype" onClick={() => selectVariant(variants[(variants.indexOf(current) + 1) % variants.length].key)}>→</button>
      </div>
    </>
  );
}

import React, { useEffect, useRef } from "react";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function NodeNamePrompt({
  position,
  value,
  error,
  onChange,
  onSubmit,
  onCancel,
  themePreset,
  title = "New node name",
  submitLabel = "Create",
}) {
  const inputRef = useRef(null);
  const isCausion = themePreset === "causion";

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  if (!position) return null;

  return (
    <div
      className={joinClasses(
        "node-name-prompt",
        isCausion ? "causion-panel" : "rounded-xl border bg-white shadow"
      )}
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -50%)" }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="node-name-prompt__title">{title}</div>
      <input
        ref={inputRef}
        type="text"
        className={joinClasses(
          "node-name-prompt__input",
          isCausion ? "causion-field" : "border rounded px-2 py-1"
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      {error ? <div className="node-name-prompt__error">{error}</div> : null}
      <div className="node-name-prompt__actions">
        <button type="button" className="node-name-prompt__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="node-name-prompt__submit" onClick={onSubmit}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

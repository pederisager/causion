import React from "react";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function NodeQuickMenu({
  id,
  value,
  range,
  isAuto,
  isRandom,
  isClamped,
  isAssignmentsPaused,
  themePreset,
  onToggleAuto,
  onToggleRandom,
  onToggleClamp,
  onValueChange,
  onDragStart,
  onDragEnd,
  onClose,
}) {
  const isCausion = themePreset === "causion";
  const safeRange = range || { min: -100, max: 100 };
  const safeValue = Number.isFinite(value) ? value : 0;
  const span = safeRange.max - safeRange.min || 1;
  const normalized = Math.min(1, Math.max(0, (safeValue - safeRange.min) / span));
  const rangeTrackStyle = isCausion
    ? {
        background: `linear-gradient(to right, var(--active) 0%, var(--active) ${normalized *
          100}%, var(--track) ${normalized * 100}%, var(--track) 100%)`,
      }
    : undefined;

  const iconButtonBase = joinClasses(
    "w-8 h-8 rounded-full border flex items-center justify-center text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
    isCausion
      ? "border-[var(--color-ink-border)] text-[var(--color-text)] focus-visible:ring-[var(--color-ink-border)]"
      : "border-slate-300 text-slate-700 bg-white shadow-sm focus-visible:ring-slate-400"
  );
  const slideBtnClass = joinClasses(
    iconButtonBase,
    isAuto &&
      (isCausion
        ? "bg-[var(--color-node-pos)] text-white border-[var(--color-node-pos)]"
        : "bg-amber-500 text-white border-amber-500")
  );
  const randomBtnClass = joinClasses(
    iconButtonBase,
    isRandom &&
      (isCausion
        ? "bg-[var(--color-node-neg)] text-white border-[var(--color-node-neg)]"
        : "bg-slate-800 text-white border-slate-800")
  );
  const doButtonClass = joinClasses(
    "px-3 py-1 rounded-full text-[0.6rem] font-semibold tracking-[0.18em] uppercase border transition",
    isCausion ? "border-[var(--color-ink-border)]" : "border-slate-300 text-slate-700",
    isClamped &&
      (isCausion
        ? "bg-[var(--color-ink-line)] text-white border-[var(--color-ink-line)]"
        : "bg-slate-900 text-white border-slate-900"),
    isAuto && "opacity-50 cursor-not-allowed"
  );

  return (
    <div
      className={joinClasses(
        "node-quick-menu nodrag nopan",
        isCausion ? "causion-panel" : "rounded-xl border bg-white shadow"
      )}
      data-causion-slider={isCausion ? "" : undefined}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {onClose ? (
        <button
          type="button"
          className="node-quick-menu__close"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label={`Close controls for ${id}`}
        >
          x
        </button>
      ) : null}
      <div className="node-quick-menu__actions">
        <button
          type="button"
          className={slideBtnClass}
          title="Toggle slide (triangle wave)"
          aria-label={isAuto ? `Stop auto slide for ${id}` : `Start auto slide for ${id}`}
          onClick={onToggleAuto}
          aria-pressed={isAuto}
          disabled={isAssignmentsPaused}
        >
          {isAuto ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          className={randomBtnClass}
          title="Toggle random (uniform draw)"
          aria-label={isRandom ? `Stop random play for ${id}` : `Start random play for ${id}`}
          onClick={onToggleRandom}
          aria-pressed={isRandom}
          disabled={isAssignmentsPaused}
        >
          🎲
        </button>
        <button
          type="button"
          className={doButtonClass}
          disabled={isAuto || isAssignmentsPaused}
          onClick={onToggleClamp}
          aria-pressed={isClamped}
          aria-label={isClamped ? `Release do() clamp for ${id}` : `Apply do() clamp for ${id}`}
        >
          DO
        </button>
      </div>
      <input
        type="range"
        min={safeRange.min}
        max={safeRange.max}
        step={1}
        value={safeValue}
        className={joinClasses("w-full", isCausion && "causion-slider__range")}
        style={rangeTrackStyle}
        onChange={(event) => onValueChange(Number(event.target.value))}
        onMouseDown={onDragStart}
        onMouseUp={(event) => onDragEnd(Number(event.currentTarget.value))}
        onMouseLeave={(event) => onDragEnd(Number(event.currentTarget.value))}
        onTouchStart={onDragStart}
        onTouchEnd={(event) => onDragEnd(Number(event.target.value))}
        onBlur={(event) => onDragEnd(Number(event.target.value))}
        disabled={isAssignmentsPaused}
      />
    </div>
  );
}

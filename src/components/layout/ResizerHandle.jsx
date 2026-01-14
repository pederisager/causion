import React, { useCallback, useRef } from "react";

const KEYBOARD_STEP = 12;

export default function ResizerHandle({
  direction = "horizontal",
  sizePx = 320,
  minSize = 240,
  maxSize = 640,
  onResize = () => {},
  className = "",
  ariaLabel,
}) {
  const startRef = useRef(null);
  const isHorizontal = direction === "horizontal";

  const clamp = useCallback(
    (value) => Math.min(maxSize, Math.max(minSize, value)),
    [maxSize, minSize]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!startRef.current) return;
      const { startPos, startSize } = startRef.current;
      const currentPos = isHorizontal ? event.clientX : event.clientY;
      const delta = currentPos - startPos;
      const nextSize = clamp(startSize - delta);
      onResize(nextSize);
    },
    [clamp, isHorizontal, onResize]
  );

  const endDrag = useCallback(() => {
    startRef.current = null;
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", endDrag);
    document.removeEventListener("pointercancel", endDrag);
    document.body.style.cursor = "";
  }, [handlePointerMove]);

  const handlePointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startRef.current = {
        startPos: isHorizontal ? event.clientX : event.clientY,
        startSize: sizePx,
      };
      document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
    },
    [endDrag, handlePointerMove, isHorizontal, sizePx]
  );

  const handleKeyDown = useCallback(
    (event) => {
      const step = event.shiftKey ? KEYBOARD_STEP * 2 : KEYBOARD_STEP;
      if (isHorizontal) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onResize(clamp(sizePx + step));
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onResize(clamp(sizePx - step));
        }
      } else {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onResize(clamp(sizePx + step));
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onResize(clamp(sizePx - step));
        }
      }
    },
    [clamp, isHorizontal, onResize, sizePx]
  );

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
      aria-label={ariaLabel || "Resize panel"}
      title={ariaLabel || "Resize panel"}
      aria-valuenow={Math.round(sizePx)}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={className}
      style={{ touchAction: "none" }}
    />
  );
}

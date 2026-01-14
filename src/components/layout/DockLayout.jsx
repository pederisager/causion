import React from "react";
import ResizerHandle from "./ResizerHandle.jsx";

const joinClasses = (...classes) => classes.filter(Boolean).join(" ");

export default function DockLayout({
  primary,
  secondary,
  isOpen = true,
  dockMode = "right",
  sizePx = 320,
  minSize = 240,
  maxSize = 640,
  onResize = () => {},
  onClose = () => {},
  className = "",
}) {
  const isOverlay = dockMode === "overlay";
  const isRight = dockMode === "right";
  const isBottom = dockMode === "bottom";

  const sizeStyle = isRight ? { width: sizePx } : { height: sizePx };
  const secondaryStyle = isOpen ? sizeStyle : { ...sizeStyle, display: "none" };
  const resizerDirection = isRight ? "horizontal" : "vertical";
  const resizerClass = joinClasses(
    "flex-shrink-0 bg-slate-300/70 hover:bg-slate-400/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
    "relative z-20",
    isRight ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize"
  );

  return (
    <div
      className={joinClasses(
        "dock-layout min-h-0 w-full h-full flex",
        isOverlay ? "relative" : "",
        isBottom && "flex-col",
        className
      )}
      data-dock-mode={dockMode}
    >
      <div className="dock-layout__primary min-h-0 min-w-0 flex-1 flex flex-col">
        {primary}
      </div>

      {isOverlay ? (
        <div
          className={joinClasses(
            "dock-layout__overlay fixed inset-0 z-50",
            !isOpen && "hidden"
          )}
          aria-hidden={!isOpen}
        >
          <div
            className="absolute inset-0 bg-slate-900/35"
            onClick={onClose}
            aria-hidden="true"
            data-testid="dock-scrim"
          />
          <div className="relative z-10 h-full w-full">{secondary}</div>
        </div>
      ) : (
        <>
          {isOpen ? (
            <ResizerHandle
              direction={resizerDirection}
              sizePx={sizePx}
              minSize={minSize}
              maxSize={maxSize}
              onResize={onResize}
              ariaLabel="Resize data panel"
              className={resizerClass}
            />
          ) : null}
          <div
            className="dock-layout__secondary min-h-0 shrink-0 flex flex-col"
            style={secondaryStyle}
            aria-hidden={!isOpen}
          >
            {secondary}
          </div>
        </>
      )}
    </div>
  );
}

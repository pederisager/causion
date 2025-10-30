import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Modal overlay displaying the SCM cheat sheet inside the app shell.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal should be shown.
 * @param {() => void} props.onClose - Callback invoked when the modal requests to close.
 * @param {string} props.cheatSheetUrl - Public URL pointing to the cheat sheet document.
 */
export default function CheatSheetModal({ isOpen, onClose, cheatSheetUrl }) {
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        // Keep focus within the modal by cycling between focusable elements we control.
        const focusable = dialogRef.current?.querySelectorAll(
          'button, a[href], iframe, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const focusArray = Array.from(focusable);
        const first = focusArray[0];
        const last = focusArray[focusArray.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const focusTimer = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusTimer);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="cheatsheet-overlay"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        className="cheatsheet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cheatsheet-title"
        ref={dialogRef}
      >
        <header className="cheatsheet-header">
          <h2 id="cheatsheet-title" className="cheatsheet-heading">
            SCM function cheat sheet
          </h2>
          <button
            type="button"
            className="cheatsheet-close"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="Close cheat sheet"
          >
            ×
          </button>
        </header>
        <div className="cheatsheet-body">
          <iframe
            title="SCM function cheat sheet"
            src={cheatSheetUrl}
            className="cheatsheet-iframe"
          />
        </div>
        <footer className="cheatsheet-footer">
          <a
            className="cheatsheet-external-link"
            href={cheatSheetUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in new tab
          </a>
          <button
            type="button"
            className="cheatsheet-dismiss"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

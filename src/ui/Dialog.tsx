import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

type Props = {
  open: boolean;
  title: string;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
  isolateKeyboard?: boolean;
  onClose: () => void;
  children: ReactNode;
};

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Dialog({
  open,
  title,
  className = "",
  initialFocusRef,
  closeOnBackdrop = true,
  isolateKeyboard = false,
  onClose,
  children,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => {
      const fallback = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (initialFocusRef?.current ?? fallback ?? dialogRef.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      returnFocusRef.current?.focus();
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  return (
    <div
      className="modalOverlay"
      onMouseDown={(event) => {
        if (!closeOnBackdrop || event.target !== event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (isolateKeyboard) event.stopPropagation();
        }}
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
            .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
          if (focusable.length === 0) {
            event.preventDefault();
            dialogRef.current?.focus();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
          event.stopPropagation();
        }}
      >
        <div id={titleId} className="modalTitle">{title}</div>
        {children}
      </div>
    </div>
  );
}

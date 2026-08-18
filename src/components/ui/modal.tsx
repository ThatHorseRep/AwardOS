"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Visually hide the title while keeping it for screen readers. */
  hideTitle?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

/**
 * Accessible modal dialog.
 *
 * Replaces nine hand-rolled `fixed inset-0` blocks, none of which set
 * `role="dialog"`, trapped focus, restored focus on close, or locked body
 * scroll — and only one of which handled Escape. Backdrop opacity and blur also
 * differed at every site.
 *
 * Rendered through a portal so a modal opened from inside a transformed or
 * `overflow-hidden` ancestor is not clipped by it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  hideTitle,
  size = "md",
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      // Without this, Tab walks out of the dialog and into the page behind it,
      // which for a screen-reader or keyboard user means silently losing the
      // dialog while it is still covering the screen.
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown, true);

    // Move focus into the dialog so the next Tab starts inside it.
    const timer = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
      target?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = overflow;
      // Return focus to whatever opened the dialog, so keyboard users do not
      // get dumped back at the top of the document.
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4"
      onMouseDown={(e) => {
        // mousedown, not click: a drag that starts inside the panel and ends on
        // the backdrop would otherwise close the dialog mid-selection.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex max-h-[calc(100dvh-1rem)] w-full flex-col rounded-lg border border-border-subtle bg-surface shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none",
          SIZES[size],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border-subtle shrink-0">
          <div className={cn("min-w-0", hideTitle && "sr-only")}>
            <h2 id={titleId} className="text-base font-bold text-content tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-xs text-content-muted mt-0.5">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-surface-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrolls internally so a tall dialog never pushes the page itself. */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="shrink-0 rounded-b-lg border-t border-border-subtle bg-surface-muted/50 p-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

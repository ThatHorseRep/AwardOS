"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 5000;

const VARIANTS: Record<
  ToastVariant,
  { Icon: typeof CheckCircle2; tone: string; role: "status" | "alert" }
> = {
  success: {
    Icon: CheckCircle2,
    tone: "text-emerald-500",
    role: "status",
  },
  error: {
    Icon: XCircle,
    tone: "text-rose-500",
    // Assertive: a failed action needs to interrupt, not wait for a pause.
    role: "alert",
  },
  warning: { Icon: AlertTriangle, tone: "text-amber-500", role: "alert" },
  info: { Icon: Info, tone: "text-accent", role: "status" },
};

/**
 * App-wide toast notifications.
 *
 * Replaces fourteen bespoke error banners, three native `alert()` calls (which
 * block the main thread and cannot be styled), and three ad-hoc `saved` boolean
 * flags. Several pages previously swallowed failures into `console.error` with
 * no user-facing feedback at all.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  useEffect(() => {
    setMounted(true);
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), DURATION_MS)
      );
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
      info: (m) => push(m, "info"),
      warning: (m) => push(m, "warning"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))] pointer-events-none"
            aria-live="polite"
          >
            {toasts.map(({ id, message, variant }) => {
              const { Icon, tone, role } = VARIANTS[variant];
              return (
                <div
                  key={id}
                  role={role}
                  className={cn(
                    "pointer-events-auto flex items-start gap-3 rounded-lg border border-border-subtle",
                    "bg-surface p-3.5 shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-200 motion-reduce:animate-none"
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", tone)} />
                  <p className="flex-1 text-xs font-medium text-content leading-relaxed break-words">
                    {message}
                  </p>
                  <button
                    type="button"
                    onClick={() => dismiss(id)}
                    aria-label="Dismiss notification"
                    className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-content-muted transition-colors hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

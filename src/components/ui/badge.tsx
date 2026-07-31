import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "purple"
    | "gold"
    | "neutral";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const base =
    "inline-flex items-center font-medium rounded-full border tracking-wide transition-colors select-none";

  const variants = {
    default:
      "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    success:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning:
      "bg-amber-500/10 text-amber-400 border-amber-500/30",
    danger:
      "bg-rose-500/10 text-rose-400 border-rose-500/30",
    info:
      "bg-sky-500/10 text-sky-400 border-sky-500/30",
    purple:
      "bg-purple-500/10 text-purple-400 border-purple-500/30",
    gold:
      "bg-amber-400/10 text-amber-300 border-amber-400/40 shadow-sm shadow-amber-500/10",
    neutral:
      "bg-slate-800 text-slate-400 border-slate-700/60",
  };

  const sizes = {
    sm: "text-[10px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
  };

  return (
    <span className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
}

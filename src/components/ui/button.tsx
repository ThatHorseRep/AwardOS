import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LoaderCircle } from "lucide-react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex min-h-11 items-center justify-center font-semibold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.97] rounded-lg motion-reduce:transform-none";

    const variants = {
      default:
        "bg-surface-raised text-content hover:bg-surface-muted border border-border-subtle shadow-sm",
      primary:
        "bg-accent text-accent-contrast hover:bg-accent-hover shadow-sm",
      secondary:
        "bg-surface-muted text-content hover:bg-border-subtle border border-border-subtle",
      outline:
        "border border-border-subtle text-content hover:bg-surface-raised",
      ghost:
        "text-content-secondary hover:text-content hover:bg-surface-raised",
      danger:
        "bg-destructive text-white hover:bg-destructive/90 shadow-sm",
      destructive:
        "bg-destructive text-white hover:bg-destructive/90 shadow-sm",
    };

    const sizes = {
      sm: "text-xs px-3 py-2 gap-1.5",
      md: "text-sm px-3.5 py-2 gap-2",
      lg: "text-base px-5 py-2.5 gap-2.5",
      icon: "size-11 p-2 text-content-secondary hover:text-content hover:bg-surface-raised",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{children}<span className="sr-only"> in progress</span></>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";


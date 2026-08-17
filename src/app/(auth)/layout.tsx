import type { Metadata } from "next";
import { Trophy } from "lucide-react";

export const metadata: Metadata = {
  title: "AwardOS — Authentication",
  description: "Sign in or sign up to AwardOS to manage your award events",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-between bg-canvas relative py-8 px-4 font-sans select-none">
      {/* Header Logo */}
      <div className="relative z-10 text-center shrink-0 pt-2">
        <div className="inline-flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-surface-raised border border-border-subtle flex items-center justify-center text-accent shadow-sm">
            <Trophy className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold text-content tracking-tight">
            AwardOS
          </span>
        </div>
        <p className="text-xs text-content-secondary mt-1 font-medium">
          The operating system for award events
        </p>
      </div>

      {/* Surface Card Container */}
      <div className="relative z-10 w-full max-w-sm mx-auto bg-surface border border-border-subtle rounded-2xl p-6 sm:p-7 shadow-sm my-auto shrink-0 text-content">
        {children}
      </div>

      {/* Footer */}
      <p className="relative z-10 text-center text-xs text-content-secondary shrink-0 pb-2">
        By continuing, you agree to AwardOS&apos;s Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}


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
    <div className="min-h-dvh w-full flex flex-col items-center justify-between bg-canvas relative py-8 px-4 font-sans">
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
      <main id="main-content" className="relative z-10 my-auto w-full max-w-sm shrink-0 rounded-lg border border-border-subtle bg-surface p-6 text-content shadow-sm sm:p-7">
        {children}
      </main>

      {/* Footer */}
      <p className="relative z-10 text-center text-xs text-content-secondary shrink-0 pb-2">
        By continuing, you agree to AwardOS&apos;s Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}


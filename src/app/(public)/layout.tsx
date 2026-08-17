import React from "react";
import Link from "next/link";
import { Trophy, ShieldCheck } from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh w-full bg-canvas text-content antialiased flex flex-col justify-between font-sans selection:bg-accent selection:text-accent-contrast">
      {/* Public Top Navbar */}
      <header className="h-16 px-6 bg-surface/85 backdrop-blur-xl border-b border-border-subtle flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-surface-raised border border-border-subtle text-accent flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
            <Trophy className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-content">
            Award<span className="text-accent">OS</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-content-secondary font-medium">
          <ShieldCheck className="w-4 h-4 text-success" />
          <span className="hidden sm:inline">Encrypted voting & ballot protection</span>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 animate-page-entrance">
        {children}
      </main>

      {/* Public Footer */}
      <footer className="py-6 border-t border-border-subtle text-center text-xs text-content-secondary font-medium bg-surface">
        Powered by <strong className="text-content font-bold">AwardOS</strong> — Recognition & Voting Platform
      </footer>
    </div>
  );
}


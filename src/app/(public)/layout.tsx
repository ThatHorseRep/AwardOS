import React from "react";
import Link from "next/link";
import { Trophy, ShieldCheck } from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#090d16] text-slate-100 antialiased flex flex-col justify-between">
      {/* Public Top Navbar */}
      <header className="h-16 px-6 glass-header border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">
            Award<span className="gradient-text">OS</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Encrypted Voting & Anti-Bot Protection</span>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>

      {/* Public Footer */}
      <footer className="py-6 border-t border-slate-800/60 text-center text-xs text-slate-500">
        Powered by <strong className="text-slate-300 font-semibold">AwardOS</strong> — Enterprise Recognition Platform
      </footer>
    </div>
  );
}

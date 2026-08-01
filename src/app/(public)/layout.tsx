import React from "react";
import Link from "next/link";
import { Trophy, ShieldCheck } from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#f4f5f8] text-slate-900 antialiased flex flex-col justify-between font-sans selection:bg-blue-500 selection:text-white">
      {/* Public Top Navbar */}
      <header className="h-16 px-6 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-slate-900">
            Award<span className="text-blue-600">OS</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">Encrypted Voting & Anti-Bot Protection</span>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>

      {/* Public Footer */}
      <footer className="py-6 border-t border-slate-200/80 text-center text-xs text-slate-500 font-medium bg-white">
        Powered by <strong className="text-slate-900 font-bold">AwardOS</strong> — Enterprise Recognition Platform
      </footer>
    </div>
  );
}

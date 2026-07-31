import type { Metadata } from "next";

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
    <div className="h-screen max-h-screen w-full flex flex-col items-center justify-between bg-[#0a0a0f] relative overflow-hidden py-4 px-4 font-sans select-none">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-transparent to-purple-950/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[350px] h-[350px] bg-purple-600/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Header Logo */}
      <div className="relative z-10 text-center shrink-0 pt-1">
        <div className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            AwardOS
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          The operating system for award events
        </p>
      </div>

      {/* Card container */}
      <div className="relative z-10 w-full max-w-sm mx-auto bg-zinc-900/70 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl shadow-black/40 my-auto shrink-0">
        {children}
      </div>

      {/* Footer */}
      <p className="relative z-10 text-center text-[10px] text-zinc-500 shrink-0 pb-1">
        By continuing, you agree to AwardOS&apos;s Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}

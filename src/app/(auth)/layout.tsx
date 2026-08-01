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
    <div className="h-screen max-h-screen w-full flex flex-col items-center justify-between bg-[#f4f5f8] relative overflow-hidden py-5 px-4 font-sans select-none">
      {/* Background soft ambient accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Header Logo */}
      <div className="relative z-10 text-center shrink-0 pt-2">
        <div className="inline-flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <svg
              width="18"
              height="18"
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
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            AwardOS
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          The operating system for award events
        </p>
      </div>

      {/* Deep Obsidian Container Card */}
      <div className="relative z-10 w-full max-w-sm mx-auto bg-zinc-950 border border-zinc-900 rounded-3xl p-6 sm:p-7 shadow-2xl my-auto shrink-0 text-white">
        {children}
      </div>

      {/* Footer */}
      <p className="relative z-10 text-center text-[11px] text-slate-500 shrink-0 pb-2">
        By continuing, you agree to AwardOS&apos;s Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}

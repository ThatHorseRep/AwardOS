import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-start justify-center gap-6 px-6 py-12">
      <div className="space-y-3">
        <p className="font-mono text-sm text-content-secondary">404</p>
        <h1 className="text-4xl font-bold text-content">This page does not exist</h1>
        <p className="max-w-prose text-base text-content-secondary">The link may be outdated, or the event may no longer be available.</p>
      </div>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98]">Go to AwardOS</Link>
    </main>
  );
}

"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#181818] text-white">
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-6 px-6 py-12">
          <div className="space-y-3">
            <p className="text-sm font-medium text-red-400">Application unavailable</p>
            <h1 className="text-3xl font-bold">AwardOS could not start</h1>
            <p className="text-base text-neutral-300">Reload the application. If this continues, contact the workspace administrator.</p>
          </div>
          <button type="button" onClick={reset} className="min-h-11 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-neutral-200 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Reload AwardOS
          </button>
        </main>
      </body>
    </html>
  );
}

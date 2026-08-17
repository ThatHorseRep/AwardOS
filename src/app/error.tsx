"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main id="main-content" className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-start justify-center gap-6 px-6 py-12">
      <div className="space-y-3">
        <p className="text-sm font-medium text-destructive">Page unavailable</p>
        <h1 className="text-3xl font-bold text-content">We could not load this page</h1>
        <p className="max-w-prose text-base text-content-secondary">Your existing data has not been changed. Try the request again or return to the dashboard.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={reset}>Try again</Button>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-content hover:text-accent">Back to dashboard</Link>
      </div>
    </main>
  );
}

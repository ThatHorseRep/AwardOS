interface LoadingBlockProps {
  className?: string;
}

function LoadingBlock({ className = "h-24" }: LoadingBlockProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-surface-raised ${className}`} />;
}

export function PageLoading() {
  return (
    <div role="status" aria-label="Loading page" className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <span className="sr-only">Loading page</span>
      <div className="space-y-3">
        <LoadingBlock className="h-8 w-56" />
        <LoadingBlock className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <LoadingBlock className="h-28" />
        <LoadingBlock className="h-28" />
        <LoadingBlock className="h-28" />
      </div>
      <LoadingBlock className="h-72" />
    </div>
  );
}

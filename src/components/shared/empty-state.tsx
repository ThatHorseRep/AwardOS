import Link from "next/link";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-start gap-4 rounded-lg border border-border-subtle bg-surface p-6 text-left">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-raised text-content-secondary">
        {icon}
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-content">{title}</h2>
        <p className="max-w-prose text-sm text-content-secondary">{description}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {action.label}
        </Link>
      )}
    </section>
  );
}

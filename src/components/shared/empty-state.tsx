import Link from 'next/link'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    href: string
  }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto border-2 border-dashed border-zinc-800/50 rounded-3xl bg-zinc-900/20">
      <div className="p-4 bg-zinc-900/80 rounded-2xl mb-4 shadow-inner border border-zinc-800/50">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 mb-6">{description}</p>
      
      {action && (
        <Link 
          href={action.href}
          className="inline-flex items-center justify-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/25"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

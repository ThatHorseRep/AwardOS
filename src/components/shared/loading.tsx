import { Trophy, Loader2 } from 'lucide-react'

export function PageLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0f]/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
        <div className="relative">
          <div className="absolute inset-0 blur-xl bg-indigo-500/30 rounded-full animate-pulse" />
          <Trophy className="w-12 h-12 text-indigo-500 animate-bounce relative z-10" />
        </div>
        <p className="text-zinc-400 text-sm font-medium tracking-wide animate-pulse">
          Loading AwardOS...
        </p>
      </div>
    </div>
  )
}

export function InlineLoading() {
  return (
    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
  )
}

import Link from 'next/link'
import { Plus, CalendarDays, Calendar } from 'lucide-react'
import EmptyState from '@/components/shared/empty-state'
import { getEventsAction } from '@/actions/events'
import { Badge } from '@/components/ui/badge'

export default async function EventsPage() {
  const eventsList = await getEventsAction()

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Events</h1>
          <p className="text-zinc-400 mt-1">Manage your award events</p>
        </div>
        <Link 
          href="/events/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/25"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </Link>
      </div>

      {eventsList.length === 0 ? (
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-12 min-h-[400px] flex items-center justify-center">
          <EmptyState 
            icon={<CalendarDays className="w-10 h-10 text-indigo-400" />}
            title="No events found"
            description="You haven't created any award events yet. Create your first event to get started."
            action={{ label: 'Create Event', href: '/events/new' }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventsList.map((evt) => (
            <div 
              key={evt.id}
              className="glass-card rounded-2xl border border-zinc-850/60 p-6 flex flex-col justify-between min-h-[200px] transition-all duration-300 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={evt.status === 'ACTIVE' ? 'success' : evt.status === 'DRAFT' ? 'neutral' : 'purple'} size="sm">
                    {evt.status}
                  </Badge>
                  <Badge variant="info" size="sm">
                    {evt.visibility}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {evt.name}
                  </h3>
                  <p className="text-zinc-400 text-xs mt-2 line-clamp-2">
                    {evt.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="border-t border-zinc-800/80 mt-6 pt-4 flex items-center justify-between text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  {new Date(evt.createdAt).toLocaleDateString()}
                </span>
                <Link 
                  href={`/events/${evt.id}`}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1 group/btn"
                >
                  Manage
                  <Plus className="w-3 h-3 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

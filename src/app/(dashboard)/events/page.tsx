export const dynamic = "force-dynamic";

import Link from 'next/link'
import { Plus, CalendarDays, Calendar, ArrowRight, Trash2 } from 'lucide-react'
import EmptyState from '@/components/shared/empty-state'
import { getEventsAction } from '@/actions/events'
import { Badge } from '@/components/ui/badge'

export default async function EventsPage() {
  const eventsList = await getEventsAction()

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-page-entrance select-none pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content tracking-tight">Award programs</h1>
          <p className="text-content-secondary text-xs mt-1 font-normal">Manage and configure your workspace award events</p>
        </div>
        <div className="flex gap-2"><Link href="/events/deleted" className="inline-flex items-center justify-center gap-2 px-3 py-2 text-content-secondary hover:text-content text-xs font-semibold"><Trash2 className="w-4 h-4" />Deleted events</Link><Link href="/events/new" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-contrast text-xs font-semibold rounded-xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] shadow-sm"><Plus className="w-4 h-4" />Create event</Link></div>
      </div>

      {eventsList.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-2xl p-12 min-h-[350px] flex items-center justify-center shadow-sm text-content">
          <EmptyState 
            icon={<CalendarDays className="w-10 h-10 text-accent" />}
            title="No events found"
            description="You haven't created any award events yet. Create your first event to get started."
            action={{ label: 'Create event', href: '/events/new' }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {eventsList.map((evt) => (
            <div 
              key={evt.id}
              className="bg-surface rounded-2xl border border-border-subtle p-6 flex flex-col justify-between min-h-[220px] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover-lift text-content group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={evt.status === 'ACTIVE' ? 'success' : evt.status === 'DRAFT' ? 'neutral' : 'default'} size="sm">
                    {evt.status.toLowerCase()}
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {evt.visibility.toLowerCase()}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-base font-bold text-content group-hover:text-accent transition-colors line-clamp-1">
                    {evt.name}
                  </h3>
                  <p className="text-content-secondary text-xs mt-1.5 line-clamp-2 font-normal">
                    {evt.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="border-t border-border-subtle mt-6 pt-4 flex items-center justify-between text-xs text-content-secondary font-medium">
                <span className="flex items-center gap-1.5 text-content-secondary">
                  <Calendar className="w-3.5 h-3.5 text-content-secondary" />
                  {new Date(evt.createdAt).toLocaleDateString()}
                </span>
                <Link 
                  href={`/events/${evt.id}`}
                  className="text-accent hover:underline font-semibold inline-flex items-center gap-1 group/btn"
                >
                  Manage
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

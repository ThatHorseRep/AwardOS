export const dynamic = "force-dynamic";

import Link from 'next/link'
import { Plus, CalendarDays, Calendar, ArrowRight } from 'lucide-react'
import EmptyState from '@/components/shared/empty-state'
import { getEventsAction } from '@/actions/events'
import { Badge } from '@/components/ui/badge'

export default async function EventsPage() {
  const eventsList = await getEventsAction()

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 select-none pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Award Programs</h1>
          <p className="text-slate-600 text-xs mt-1 font-medium">Manage and configure your workspace award events</p>
        </div>
        <Link 
          href="/events/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full transition-all shadow-md shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </Link>
      </div>

      {eventsList.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-12 min-h-[350px] flex items-center justify-center shadow-sm">
          <EmptyState 
            icon={<CalendarDays className="w-10 h-10 text-blue-600" />}
            title="No events found"
            description="You haven't created any award events yet. Create your first event to get started."
            action={{ label: 'Create Event', href: '/events/new' }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {eventsList.map((evt) => (
            <div 
              key={evt.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-6 flex flex-col justify-between min-h-[220px] transition-all duration-300 hover:border-blue-500/50 hover:shadow-md group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={evt.status === 'ACTIVE' ? 'success' : evt.status === 'DRAFT' ? 'neutral' : 'purple'} size="sm">
                    {evt.status}
                  </Badge>
                  <Badge variant="info" size="sm">
                    {evt.visibility}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {evt.name}
                  </h3>
                  <p className="text-slate-600 text-xs mt-1.5 line-clamp-2 font-medium">
                    {evt.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 mt-6 pt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(evt.createdAt).toLocaleDateString()}
                </span>
                <Link 
                  href={`/events/${evt.id}`}
                  className="text-blue-600 hover:text-blue-700 font-bold inline-flex items-center gap-1 group/btn"
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

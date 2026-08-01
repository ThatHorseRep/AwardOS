import { getOrCreateWorkspaceAction, getCurrentUser } from '@/actions/workspaces'
import { db } from '@/lib/db'
import { events, nominations, votes } from '@/lib/db/schema'
import { count, eq, and, isNull } from 'drizzle-orm'
import { CalendarPlus, Sparkles, Archive, UserPlus, Calendar, CheckSquare, Users, ChevronRight, Vote, Award, ArrowUpRight } from 'lucide-react'
import EmptyState from '@/components/shared/empty-state'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const displayName = user?.displayName || 'User'
  const workspace = await getOrCreateWorkspaceAction()

  // Fetch stats from DB
  const eventsResult = await db
    .select({ val: count() })
    .from(events)
    .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
  const totalEvents = eventsResult[0]?.val || 0

  const nominationsResult = await db
    .select({ val: count() })
    .from(nominations)
    .innerJoin(events, eq(nominations.eventId, events.id))
    .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
  const totalNominations = nominationsResult[0]?.val || 0

  const votesResult = await db
    .select({ val: count() })
    .from(votes)
    .innerJoin(events, eq(votes.eventId, events.id))
    .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
  const totalVotes = votesResult[0]?.val || 0

  // Fetch recent events
  const recentEvents = await db
    .select()
    .from(events)
    .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
    .orderBy(events.createdAt)
    .limit(4)

  const quickActions = [
    { icon: CalendarPlus, title: 'Create Event', subtitle: 'Start a new award program', href: '/events/new', color: 'bg-blue-600/10 text-blue-600' },
    { icon: Sparkles, title: 'AI Assistant', subtitle: 'Auto-generate category lists', href: '/settings/ai', color: 'bg-purple-600/10 text-purple-600' },
    { icon: Vote, title: 'Voting Hub', subtitle: 'Manage active ballot streams', href: '/voting', color: 'bg-emerald-600/10 text-emerald-600' },
    { icon: UserPlus, title: 'Invite Team', subtitle: 'Add workspace collaborators', href: '/team', color: 'bg-amber-600/10 text-amber-600' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 select-none pb-8">
      
      {/* Hero Obsidian Charcoal Card */}
      <div className="rounded-3xl bg-zinc-950 p-6 md:p-8 border border-zinc-900 shadow-2xl text-white relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-blue-400">
            <Sparkles className="w-3.5 h-3.5" /> Workspace Live Overview
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {totalEvents} Active {totalEvents === 1 ? 'Program' : 'Programs'}
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 leading-relaxed">
            Manage award workflows, review nomination submissions, and monitor ballot integrity in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          <Link href="/events">
            <button className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 group">
              <span>View All Events</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </Link>
          <Link href="/events/new">
            <button className="px-5 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-white font-bold text-xs transition-all flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-blue-400" />
              <span>Create Event</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Programs</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{totalEvents}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Nominations</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{totalNominations}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Votes Recorded</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{totalVotes}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
            <CheckSquare className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Events List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Recent Award Programs</h2>
            <Link href="/events" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
              <span>See All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-8 min-h-[220px] flex items-center justify-center shadow-sm">
              <EmptyState 
                icon={<CalendarPlus className="w-8 h-8 text-blue-600" />}
                title="No events yet"
                description="Create your first award event to get started"
                action={{ label: 'Create Event', href: '/events/new' }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {recentEvents.map((evt) => (
                <Link 
                  key={evt.id}
                  href={`/events/${evt.id}`}
                  className="p-4 rounded-3xl bg-white border border-slate-200/80 hover:border-blue-500/50 hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">{evt.name}</h3>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{evt.description || 'No description provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={evt.status === 'ACTIVE' ? 'success' : evt.status === 'DRAFT' ? 'neutral' : 'purple'} size="sm">
                      {evt.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Grid */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3">
            {quickActions.map((action, i) => (
              <Link 
                key={i} 
                href={action.href}
                className="group flex items-center gap-3.5 p-3.5 rounded-3xl bg-white border border-slate-200/80 hover:border-blue-500/50 hover:shadow-md transition-all"
              >
                <div className={`p-3 rounded-2xl ${action.color} shrink-0 group-hover:scale-105 transition-transform`}>
                  <action.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{action.title}</h3>
                  <p className="text-[11px] text-slate-500">{action.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}

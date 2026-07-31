import { getOrCreateWorkspaceAction, getCurrentUser } from '@/actions/workspaces'
import { db } from '@/lib/db'
import { events, nominations, votes } from '@/lib/db/schema'
import { count, eq, and, isNull } from 'drizzle-orm'
import { CalendarPlus, Sparkles, Archive, UserPlus, Calendar, CheckSquare, Users } from 'lucide-react'
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

  const stats = [
    { label: 'Total Events', value: String(totalEvents), icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Total Nominations', value: String(totalNominations), icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'Total Votes', value: String(totalVotes), icon: CheckSquare, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  ]

  const quickActions = [
    { icon: CalendarPlus, title: 'Create Event', subtitle: 'Start a new award process', href: '/events/new', color: 'group-hover:text-indigo-400' },
    { icon: Sparkles, title: 'AI Assistant', subtitle: 'Get help setting up categories', href: '/settings/ai', color: 'group-hover:text-purple-400' },
    { icon: Archive, title: 'Browse Archive', subtitle: 'View past award events', href: '/events', color: 'group-hover:text-blue-400' },
    { icon: UserPlus, title: 'Invite Team', subtitle: 'Add members to workspace', href: '/team', color: 'group-hover:text-emerald-400' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-4 lg:space-y-5 animate-in fade-in duration-300">
      
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back, {displayName}</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Here&apos;s a quick overview of your workspace</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {stats.map((stat, i) => (
          <div key={i} className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/60 rounded-2xl p-4 transition-all hover:border-zinc-700/60 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-xs font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${stat.bg} group-hover:scale-105 transition-transform duration-300`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Recent Events */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-base font-semibold text-white">Recent Events</h2>
          {recentEvents.length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 min-h-[220px] flex items-center justify-center">
              <EmptyState 
                icon={<CalendarPlus className="w-7 h-7 text-indigo-400" />}
                title="No events yet"
                description="Create your first award event to get started"
                action={{ label: 'Create Event', href: '/events/new' }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {recentEvents.map((evt) => (
                <Link 
                  key={evt.id}
                  href={`/events/${evt.id}`}
                  className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-800/70 hover:border-zinc-700/80 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors line-clamp-1">{evt.name}</h3>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">{evt.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={evt.status === 'ACTIVE' ? 'success' : evt.status === 'DRAFT' ? 'neutral' : 'purple'} size="sm">
                      {evt.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-2.5">
            {quickActions.map((action, i) => (
              <Link 
                key={i} 
                href={action.href}
                className="group flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-800/70 hover:border-zinc-700/80 transition-all"
              >
                <div className="p-2.5 bg-zinc-950 rounded-xl group-hover:scale-105 transition-transform duration-300 shrink-0">
                  <action.icon className={`w-4 h-4 text-zinc-400 transition-colors ${action.color}`} />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-zinc-200 group-hover:text-white transition-colors">{action.title}</h3>
                  <p className="text-[11px] text-zinc-500">{action.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
      
    </div>
  )
}

import { getOrCreateWorkspaceAction } from '@/actions/workspaces';
import { db } from '@/lib/db';
import { events, nominations, voteSessions } from '@/lib/db/schema';
import { count, countDistinct, eq, and, isNull } from 'drizzle-orm';
import { CalendarPlus, Sparkles, UserPlus, Calendar, CheckSquare, Users, ChevronRight, Vote, Award, ArrowUpRight } from 'lucide-react';
import EmptyState from '@/components/shared/empty-state'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge';

export default async function DashboardPage() {
  const workspace = await getOrCreateWorkspaceAction()

  let totalEvents = 0
  let totalNominations = 0
  let submittedBallots = 0
  let recentEvents: Array<typeof events.$inferSelect> = []

  if (workspace?.id) {
    try {
      const eventsResult = await db
        .select({ val: count() })
        .from(events)
        .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
      totalEvents = eventsResult[0]?.val || 0

      const nominationsResult = await db
        .select({ val: count() })
        .from(nominations)
        .innerJoin(events, eq(nominations.eventId, events.id))
        .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
      totalNominations = nominationsResult[0]?.val || 0

      const ballotsResult = await db
        .select({ val: countDistinct(voteSessions.id) })
        .from(voteSessions)
        .innerJoin(events, eq(voteSessions.eventId, events.id))
        .where(and(eq(events.workspaceId, workspace.id), eq(voteSessions.status, 'SUBMITTED'), isNull(events.deletedAt)))
      submittedBallots = ballotsResult[0]?.val || 0

      recentEvents = await db
        .select()
        .from(events)
        .where(and(eq(events.workspaceId, workspace.id), isNull(events.deletedAt)))
        .orderBy(events.createdAt)
        .limit(4)
    } catch (err) {
      console.warn("Dashboard stats query error:", err)
    }
  }

  const quickActions = [
    { icon: CalendarPlus, title: 'Create event', subtitle: 'Start a new award program', href: '/events/new' },
    { icon: Sparkles, title: 'AI assistant', subtitle: 'Auto-generate category lists', href: '/settings/ai' },
    { icon: Vote, title: 'Voting setup', subtitle: 'Configure and preview event ballots', href: '/voting' },
    { icon: UserPlus, title: 'Invite team', subtitle: 'Add workspace collaborators', href: '/team' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-page-entrance select-none pb-12">
      
      {/* Hero Overview Card */}
      <section 
        aria-label="Workspace summary"
        className="rounded-2xl bg-surface p-6 md:p-8 border border-border-subtle text-content relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover-lift"
      >
        <div className="space-y-2 z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-muted border border-border-subtle text-xs font-medium text-content-secondary">
            <Sparkles className="w-3.5 h-3.5 text-accent" /> Workspace live overview
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-content">
            {totalEvents} Active {totalEvents === 1 ? 'Program' : 'Programs'}
          </h1>
          <p className="text-xs md:text-sm text-content-secondary leading-relaxed max-w-[65ch]">
            Review incoming nominations, monitor voter turnout, and oversee active ballots across your workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          <Link href="/events">
            <button className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-contrast font-semibold text-xs btn-interactive flex items-center gap-2 group">
              <span>View all events</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </Link>
          <Link href="/events/new">
            <button className="px-5 py-2.5 rounded-full bg-surface-raised hover:bg-surface-muted border border-border-subtle text-content font-semibold text-xs btn-interactive flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-accent" />
              <span>Create event</span>
            </button>
          </Link>
        </div>
      </section>

      {/* Metric Cards Row */}
      <section aria-label="Key metrics" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm hover-lift flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-content-secondary block">Total programs</span>
            <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{totalEvents}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-surface-muted border border-border-subtle flex items-center justify-center text-content">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm hover-lift flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-content-secondary block">Total nominations</span>
            <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{totalNominations}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-surface-muted border border-border-subtle flex items-center justify-center text-content">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm hover-lift flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-content-secondary block">Submitted ballots</span>
            <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{submittedBallots}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-surface-muted border border-border-subtle flex items-center justify-center text-content">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Events List */}
        <section aria-label="Recent award programs" className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-content tracking-tight">Recent award programs</h2>
            <Link href="/events" className="text-xs font-semibold text-accent hover:underline flex items-center gap-1">
              <span>See all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentEvents.length === 0 ? (
            <div className="bg-surface border border-border-subtle rounded-2xl p-8 min-h-[220px] flex items-center justify-center shadow-sm">
              <EmptyState 
                icon={<CalendarPlus className="w-8 h-8 text-accent" />}
                title="No events yet"
                description="Create your first award event to get started"
                action={{ label: 'Create event', href: '/events/new' }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {recentEvents.map((evt) => (
                <Link 
                  key={evt.id}
                  href={`/events/${evt.id}`}
                  className="p-4 rounded-2xl bg-surface border border-border-subtle hover:border-accent/40 shadow-sm hover-lift flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-muted border border-border-subtle text-accent flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition-transform">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-content group-hover:text-accent transition-colors line-clamp-1">{evt.name}</h3>
                      <p className="text-xs text-content-secondary line-clamp-1 mt-0.5">{evt.description || 'No description provided'}</p>
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
        </section>

        {/* Quick Actions Grid */}
        <section aria-label="Quick actions" className="space-y-4">
          <h2 className="text-base font-bold text-content tracking-tight">Quick actions</h2>
          <div className="grid grid-cols-1 gap-3">
            {quickActions.map((action, i) => (
              <Link 
                key={i} 
                href={action.href}
                className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface border border-border-subtle hover:border-accent/40 shadow-sm hover-lift btn-interactive"
              >
                <div className="p-2.5 rounded-xl bg-surface-muted border border-border-subtle text-accent shrink-0 group-hover:scale-105 transition-transform">
                  <action.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-content group-hover:text-accent transition-colors">{action.title}</h3>
                  <p className="text-xs text-content-secondary">{action.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>

    </div>
  )
}

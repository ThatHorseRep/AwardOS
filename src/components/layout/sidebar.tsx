'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Settings, 
  Trophy,
  ChevronLeft,
  ChevronRight,
  Vote,
  Inbox
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Calendar, label: 'Events', href: '/events' },
  { icon: Inbox, label: 'Nominations', href: '/nominations' },
  { icon: Vote, label: 'Voting setup', href: '/voting' },
  { icon: Users, label: 'Members', href: '/team' },
  { icon: Settings, label: 'Settings', href: '/settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside 
      className={`
        hidden md:flex flex-col
        bg-surface border-r border-border-subtle 
        h-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] relative select-none shrink-0
        ${collapsed ? 'w-[72px]' : 'w-[250px]'}
      `}
    >
      {/* Brand Header */}
      <div className="flex items-center h-16 px-4 border-b border-border-subtle shrink-0">
        <div className="w-9 h-9 rounded-xl bg-surface-raised border border-border-subtle flex items-center justify-center text-accent shrink-0 shadow-sm">
          <Trophy className="w-4 h-4" />
        </div>
        {!collapsed && (
          <div className="ml-3 min-w-0">
            <span className="font-bold text-base tracking-tight text-content block leading-none truncate">
              AwardOS
            </span>
            <span className="text-xs text-content-secondary font-medium mt-0.5 block truncate">Award programs</span>
          </div>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 overflow-y-auto px-2.5">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`))
            return (
              <li key={item.href}>
                <Link 
                  href={item.href}
                  className={`
                    flex min-h-11 items-center rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 group active:scale-[0.97]
                    ${isActive 
                      ? 'bg-accent text-accent-contrast shadow-sm' 
                      : 'text-content-secondary hover:text-content hover:bg-surface-raised'
                    }
                  `}
                >
                  <item.icon className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-accent-contrast' : 'text-content-secondary group-hover:text-content'}`} />
                  {!collapsed && (
                    <span className="ml-3 truncate">
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2.5 border-t border-border-subtle">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex min-h-11 w-full items-center justify-center rounded-lg py-2 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-raised hover:text-content"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}


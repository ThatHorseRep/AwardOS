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
  Sparkles,
  Inbox
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Calendar, label: 'Events', href: '/events' },
  { icon: Inbox, label: 'Nominations', href: '/nominations' },
  { icon: Vote, label: 'Voting Hub', href: '/voting' },
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
        h-full transition-all duration-300 relative select-none shrink-0
        ${collapsed ? 'w-[76px]' : 'w-[260px]'}
      `}
    >
      {/* Brand Header */}
      <div className="flex items-center h-16 px-5 border-b border-border-subtle shrink-0">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20 shrink-0">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="ml-3">
            <span className="font-bold text-lg tracking-tight text-content block leading-none">
              AwardOS
            </span>
            <span className="text-[10px] text-content-muted font-medium">Event Engine</span>
          </div>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-5 overflow-y-auto px-3">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`))
            return (
              <li key={item.href}>
                <Link 
                  href={item.href}
                  className={`
                    flex items-center px-3.5 py-2.5 rounded-full transition-all text-xs font-semibold group
                    ${isActive 
                      ? 'bg-accent text-accent-contrast shadow-md shadow-accent/25' 
                      : 'text-content-muted hover:text-content hover:bg-surface-muted'
                    }
                  `}
                >
                  <item.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-accent-contrast' : 'text-content-muted'}`} />
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
      <div className="p-3 border-t border-border-subtle">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-full text-content-muted hover:text-content hover:bg-surface-muted transition-colors text-xs font-medium"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}

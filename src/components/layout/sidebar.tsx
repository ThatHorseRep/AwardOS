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
  ChevronRight
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Calendar, label: 'Events', href: '/events' },
  { icon: Users, label: 'Members', href: '/team' },
  { icon: Settings, label: 'Settings', href: '/settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <aside 
        className={`
          hidden md:flex flex-col
          bg-zinc-950 border-r border-zinc-800/50 
          h-full transition-all duration-300 relative
          ${collapsed ? 'w-[72px]' : 'w-[280px]'}
        `}
      >
        <div className="flex items-center h-16 px-4 border-b border-zinc-800/50 shrink-0">
          <Trophy className="w-8 h-8 text-indigo-500 shrink-0" />
          {!collapsed && (
            <span className="ml-3 font-bold text-xl tracking-tight text-white truncate transition-opacity duration-300">
              AwardOS
            </span>
          )}
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    className={`
                      flex items-center px-3 py-2.5 rounded-xl transition-all group
                      ${isActive 
                        ? 'bg-indigo-600/10 text-indigo-400' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                      }
                    `}
                  >
                    <div className="relative flex items-center justify-center shrink-0">
                      {isActive && (
                        <div className="absolute -left-[13px] h-5 w-1 bg-indigo-500 rounded-r-full" />
                      )}
                      <item.icon className="w-5 h-5 shrink-0" />
                    </div>
                    {!collapsed && (
                      <span className="ml-3 font-medium truncate">
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-zinc-800/50">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>
    </>
  )
}

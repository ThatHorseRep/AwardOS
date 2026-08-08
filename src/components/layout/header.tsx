'use client'

import { useState } from 'react'
import { Menu, Bell, X, LayoutDashboard, Calendar, Inbox, Vote, Users, Settings, LogOut, User } from 'lucide-react'
import { signOutAction } from '@/actions/auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface HeaderProps {
  user: {
    email: string
    displayName: string
    avatarUrl?: string | null
  }
}

export default function Header({ user }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Calendar, label: 'Events', href: '/events' },
    { icon: Inbox, label: 'Nominations', href: '/nominations' },
    { icon: Vote, label: 'Voting Hub', href: '/voting' },
    { icon: Users, label: 'Members', href: '/team' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ]

  const handleSignOut = async () => {
    setDropdownOpen(false);
    try {
      await signOutAction();
    } catch (err) {
      console.warn("Sign out fallback redirect:", err);
    }
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-4 md:px-6 bg-surface/90 backdrop-blur-xl border-b border-border-subtle shrink-0 select-none">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-content-muted hover:text-content rounded-full hover:bg-surface-muted transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex flex-col">
          <span className="text-sm font-bold text-content tracking-tight">
            {getGreeting()}, {user.displayName}! 👋
          </span>
          <span className="text-[10px] text-content-muted font-medium">Workspace Overview</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle className="hidden sm:inline-flex" />

        <button className="relative p-2 text-content-muted hover:text-content rounded-full hover:bg-surface-muted transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full ring-2 ring-surface" />
        </button>

        <div className="relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center justify-center rounded-full hover:opacity-90 transition-opacity"
          >
            <Avatar src={user.avatarUrl} name={user.displayName} size="md" className="ring-2 ring-blue-500/40" />
          </button>

          {dropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface border border-border-subtle shadow-2xl overflow-hidden z-50 animate-in fade-in duration-150">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                  <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-content truncate">{user.displayName}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="py-1">
                  <Link 
                    href="/settings/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span>User Profile & DP</span>
                  </Link>
                  <Link 
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Workspace Settings</span>
                  </Link>
                </div>
                <div className="border-t border-zinc-800 py-1">
                  <button 
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-xs font-medium text-left text-red-400 hover:bg-red-400/10 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 bg-zinc-950 border-b border-zinc-900 p-4 md:hidden z-50 animate-in slide-in-from-top-2 duration-200">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`))
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center px-4 py-3 rounded-full text-xs font-semibold transition-all
                      ${isActive 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                      }
                    `}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </header>
  )
}

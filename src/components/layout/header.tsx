'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Menu, Bell, X, LayoutDashboard, Calendar, Inbox, Vote, Users, Settings, LogOut, User, Search, Sparkles } from 'lucide-react'
import { signOutAction } from '@/actions/auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { CommandPalette } from '@/components/layout/command-palette'
import { AIAssistantPanel } from '@/components/ai/assistant-panel'

interface HeaderProps {
  user: {
    email: string
    displayName: string
    avatarUrl?: string | null
  }
  workspaceSwitcher?: React.ReactNode
}

export default function Header({ user, workspaceSwitcher }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const pathname = usePathname()
  const eventId = pathname.match(/^\/events\/([^/]+)/)?.[1]

  useEffect(() => {
    const togglePalette = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', togglePalette)
    return () => window.removeEventListener('keydown', togglePalette)
  }, [])

  useEffect(() => {
    const closeOverlays = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        setDropdownOpen(false)
      }
    }
    window.addEventListener('keydown', closeOverlays)
    return () => window.removeEventListener('keydown', closeOverlays)
  }, [])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Calendar, label: 'Events', href: '/events' },
    { icon: Inbox, label: 'Nominations', href: '/nominations' },
    { icon: Vote, label: 'Voting setup', href: '/voting' },
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
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-content-secondary transition-colors hover:bg-surface-raised hover:text-content active:scale-95 md:hidden"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex min-w-0 flex-col">
          <span className="max-w-28 truncate text-sm font-bold text-content tracking-tight sm:max-w-none">
            {getGreeting()}, {user.displayName}
          </span>
          <div className="hidden items-center gap-2 sm:flex"><span className="text-xs text-content-secondary font-medium">Workspace overview</span>{workspaceSwitcher}</div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
        <button type="button" onClick={() => setCommandOpen(true)} aria-label="Open command palette" className="hidden items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-xs text-content-secondary hover:text-content sm:flex">
          <Search className="size-3.5" /><span>Search</span><kbd className="ml-2 text-[10px] text-content-muted">Ctrl K</kbd>
        </button>
        <ThemeToggle className="hidden sm:inline-flex" />

        <button type="button" onClick={() => setAssistantOpen(true)} aria-label="Open AI assistant" className="flex size-11 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-raised hover:text-accent"><Sparkles className="size-4" /></button>

        <button 
          aria-label="Notifications"
          className="relative flex size-11 items-center justify-center rounded-lg text-content-secondary transition-colors hover:bg-surface-raised hover:text-content active:scale-95"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full ring-2 ring-surface" />
        </button>

        <div className="relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-label="User profile menu"
            className="flex size-11 items-center justify-center rounded-full transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Avatar src={user.avatarUrl} name={user.displayName} size="md" className="ring-2 ring-border-subtle" />
          </button>

          {dropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface border border-border-subtle shadow-xl overflow-hidden z-50 animate-scale-in">
                <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-3">
                  <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-content truncate">{user.displayName}</p>
                    <p className="text-xs text-content-secondary truncate">{user.email}</p>
                  </div>
                </div>
                <div className="py-1">
                  <Link 
                    href="/settings/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full px-4 py-2 text-xs font-medium text-content-secondary hover:bg-surface-raised hover:text-content transition-colors flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-accent" />
                    <span>User profile & photo</span>
                  </Link>
                  <Link 
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full px-4 py-2 text-xs font-medium text-content-secondary hover:bg-surface-raised hover:text-content transition-colors flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Workspace settings</span>
                  </Link>
                </div>
                <div className="border-t border-border-subtle py-1">
                  <button 
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-xs font-medium text-left text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && typeof document !== 'undefined' && createPortal(
        <><button type="button" aria-label="Close navigation" className="fixed inset-x-0 bottom-0 top-16 z-40 bg-black/40 md:hidden" onClick={() => setMobileMenuOpen(false)} /><nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-b border-border-subtle bg-surface/95 p-4 backdrop-blur-2xl animate-slide-up motion-reduce:animate-none md:hidden">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}`))
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center px-4 py-3 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]
                      ${isActive 
                        ? 'bg-accent text-accent-contrast shadow-sm' 
                        : 'text-content-secondary hover:text-content hover:bg-surface-raised'
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
        </nav></>,
        document.body
      )}
      <CommandPalette isOpen={commandOpen} onClose={() => setCommandOpen(false)} />
      <AIAssistantPanel isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} eventId={eventId} />
    </header>
  )
}


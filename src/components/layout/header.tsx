'use client'

import { useState } from 'react'
import { Menu, Bell } from 'lucide-react'
import { signOutAction } from '@/actions/auth'

interface HeaderProps {
  user: {
    email: string
    displayName: string
  }
}

export default function Header({ user }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-4 md:px-8 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 shrink-0">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50">
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden md:block text-sm font-medium text-zinc-400">
          Workspace <span className="mx-2 text-zinc-600">/</span> Overview
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/50 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-zinc-950" />
        </button>

        <div className="relative">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            {getInitials(user.displayName)}
          </button>

          {dropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 border-b border-zinc-800">
                  <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{user.email}</p>
                </div>
                <div className="py-1">
                  <button className="w-full px-4 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                    Profile
                  </button>
                  <button className="w-full px-4 py-2 text-sm text-left text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                    Settings
                  </button>
                </div>
                <div className="border-t border-zinc-800 py-1">
                  <button 
                    onClick={() => signOutAction()}
                    className="w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Trophy,
  UserCheck,
  Vote,
  Award,
  Sparkles,
  Palette,
  ShieldAlert,
  BarChart3,
  Users,
  Settings,
  X,
  ArrowRight,
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const navigationCommands = [
    { label: "Dashboard Overview", path: "/dashboard", icon: Trophy, category: "Navigation" },
    { label: "Manage Award Events", path: "/events", icon: Trophy, category: "Events" },
    { label: "Create New Event Wizard", path: "/events/new", icon: Trophy, category: "Events" },
    { label: "Raw Nominations Stream", path: "/nominations", icon: UserCheck, category: "Nominations" },
    { label: "AI Nomination Cleanup Engine", path: "/cleanup", icon: Sparkles, category: "AI Tools" },
    { label: "Voting & Ballot Control Center", path: "/voting", icon: Vote, category: "Voting" },
    { label: "Official Results Leaderboard", path: "/results", icon: Award, category: "Results" },
    { label: "Anti-Fraud Security Monitoring", path: "/integrity", icon: ShieldAlert, category: "Security" },
    { label: "Real-Time Velocity Analytics", path: "/analytics", icon: BarChart3, category: "Analytics" },
    { label: "Custom Event Branding Studio", path: "/branding", icon: Palette, category: "Design" },
    { label: "Award Certificate Generator Studio", path: "/certificates", icon: Award, category: "Tools" },
    { label: "Workspace Data Exporter", path: "/exports", icon: Settings, category: "Tools" },
    { label: "Team & Access Control", path: "/team", icon: Users, category: "Settings" },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const filtered = navigationCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-start justify-center pt-24 p-4 z-50 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Input Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search... (Esc to close)"
            className="w-full bg-transparent text-slate-100 text-sm focus:outline-none placeholder:text-slate-500"
          />
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching commands or routes found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelect(cmd.path)}
                  className="p-3 rounded-xl hover:bg-indigo-600/20 text-slate-200 hover:text-white flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 text-slate-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold block">{cmd.label}</span>
                      <span className="text-[10px] text-slate-500 block">{cmd.category}</span>
                    </div>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

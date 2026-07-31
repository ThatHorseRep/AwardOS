"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Settings2,
  Bot,
  Users,
  AlertTriangle,
  Globe,
  Check,
  Save,
  ShieldCheck,
  Lock,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [subdomain, setSubdomain] = useState("campus-awards");
  const [customDomain, setCustomDomain] = useState("awards.university.edu");
  const [sslStatus, setSslStatus] = useState<"ACTIVE" | "PENDING">("ACTIVE");
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  const sections = [
    {
      title: "General & Branding",
      description: "Workspace details, default themes and white-labeling",
      icon: Settings2,
      color: "text-zinc-400",
      href: "/branding",
    },
    {
      title: "AI Assistant Provider",
      description: "Configure Gemini, OpenAI, and Anthropic keys",
      icon: Bot,
      color: "text-indigo-400",
      href: "/settings/ai",
    },
    {
      title: "Team & Role Access",
      description: "Manage workspace members and permissions",
      icon: Users,
      color: "text-blue-400",
      href: "/team",
    },
    {
      title: "Danger Zone",
      description: "Archive or delete workspace data",
      icon: AlertTriangle,
      color: "text-red-400",
      href: "#",
    },
  ];

  const handleSaveDomainSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 font-sans pb-16">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Workspace Settings</h1>
        <p className="text-zinc-400 text-xs mt-1">
          Manage custom domains, AI provider keys, team permissions, and workspace preferences.
        </p>
      </div>

      {/* Navigation Quick Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <Link key={i} href={section.href}>
              <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-900 hover:border-zinc-700 transition-all cursor-pointer group flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-zinc-950 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Icon className={`w-5 h-5 ${section.color}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">
                      {section.title}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{section.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Custom Subdomain & White-Labeling Section */}
      <Card className="border-indigo-500/25 bg-slate-950/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" />
              <CardTitle className="text-base font-bold text-white">Custom Subdomains & White-Label CNAME</CardTitle>
            </div>
            <Badge variant="purple" size="sm">ENTERPRISE</Badge>
          </div>
          <CardDescription className="text-xs">
            Host your voting events on custom subdomains or dedicated organization web domains.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSaveDomainSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">AwardOS Subdomain Alias</label>
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2">
                  <input
                    type="text"
                    required
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                  />
                  <span className="text-xs text-slate-500 font-mono shrink-0">.awardos.io</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Custom Organization Domain (CNAME)</label>
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="awards.yourdomain.com"
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* DNS Records Guidance Box */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> DNS CNAME Routing Status
                </span>
                <Badge variant="success" size="sm">SSL CERTIFIED</Badge>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                Point CNAME <strong className="text-slate-200">{customDomain}</strong> to <strong className="text-indigo-400">cname.awardos.io</strong> in your domain DNS registrar.
              </p>
            </div>

            {/* White-Labeling Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-900/80">
              <div>
                <span className="text-xs font-semibold text-white block">Remove "Powered by AwardOS" Branding</span>
                <span className="text-[11px] text-slate-400">Hide footer attribution for fully custom enterprise portals</span>
              </div>
              <input
                type="checkbox"
                checked={whiteLabelEnabled}
                onChange={(e) => setWhiteLabelEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <Button type="submit" variant="primary" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
              {saved ? <Check className="w-4 h-4 mr-1.5 text-emerald-300" /> : <Save className="w-4 h-4 mr-1.5" />}
              <span>{saved ? "Domain Settings Saved!" : "Save Domain Configuration"}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

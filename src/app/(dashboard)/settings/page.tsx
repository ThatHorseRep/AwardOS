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
  User,
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
      title: "User Profile & DP",
      description: "Manage display name, avatar photo, and credentials",
      icon: User,
      color: "text-indigo-600 bg-indigo-50",
      href: "/settings/profile",
    },
    {
      title: "General & Branding",
      description: "Workspace details, default themes and white-labeling",
      icon: Settings2,
      color: "text-blue-600 bg-blue-50",
      href: "/branding",
    },
    {
      title: "AI Assistant Provider",
      description: "Configure Gemini, OpenAI, and Anthropic keys",
      icon: Bot,
      color: "text-purple-600 bg-purple-50",
      href: "/settings/ai",
    },
    {
      title: "Team & Role Access",
      description: "Manage workspace members and permissions",
      icon: Users,
      color: "text-emerald-600 bg-emerald-50",
      href: "/team",
    },
    {
      title: "Danger Zone",
      description: "Delete your account and erase your personal data",
      icon: AlertTriangle,
      color: "text-rose-600 bg-rose-50",
      href: "/settings/account",
    },
  ];

  const handleSaveDomainSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300 font-sans pb-16 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workspace Settings</h1>
        <p className="text-slate-600 text-xs mt-1 font-medium">
          Manage custom domains, AI provider keys, team permissions, and workspace preferences.
        </p>
      </div>

      {/* Navigation Quick Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section, i) => {
          const Icon = section.icon;
          return (
            <Link key={i} href={section.href}>
              <div className="p-5 rounded-3xl bg-white border border-slate-200/80 hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${section.color} group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {section.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">{section.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Custom Subdomain & White-Labeling Section */}
      <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900">Custom Subdomains & White-Label CNAME</CardTitle>
            </div>
            <Badge variant="purple" size="sm">ENTERPRISE</Badge>
          </div>
          <CardDescription className="text-xs text-slate-600 font-medium">
            Host your voting events on custom subdomains or dedicated organization web domains.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <form onSubmit={handleSaveDomainSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">AwardOS Subdomain Alias</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5">
                  <input
                    type="text"
                    required
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-medium text-slate-900 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500 font-mono shrink-0 font-medium">.awardos.io</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Custom Organization Domain (CNAME)</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="awards.yourdomain.com"
                    className="w-full bg-transparent text-xs font-mono font-medium text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* DNS Records Guidance Box */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-blue-950 font-bold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> DNS CNAME Routing Status
                </span>
                <Badge variant="success" size="sm">SSL CERTIFIED</Badge>
              </div>
              <p className="text-[11px] text-blue-900 leading-relaxed font-mono font-medium">
                Point CNAME <strong className="text-blue-950">{customDomain}</strong> to <strong className="text-blue-600">cname.awardos.io</strong> in your domain DNS registrar.
              </p>
            </div>

            {/* White-Labeling Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Remove &quot;Powered by AwardOS&quot; Branding</span>
                <span className="text-[11px] text-slate-500 font-medium">Hide footer attribution for fully custom enterprise portals</span>
              </div>
              <input
                type="checkbox"
                checked={whiteLabelEnabled}
                onChange={(e) => setWhiteLabelEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-100 border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <Button type="submit" variant="primary" size="sm" className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
              {saved ? <Check className="w-4 h-4 mr-1.5 text-emerald-300" /> : <Save className="w-4 h-4 mr-1.5" />}
              <span>{saved ? "Domain Settings Saved!" : "Save Domain Configuration"}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

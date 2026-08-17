import Link from "next/link";
import { AlertTriangle, Bot, ChevronRight, Settings2, User, Users } from "lucide-react";

const sections = [
  { title: "User profile and avatar", description: "Manage your display name, avatar, and account profile.", icon: User, href: "/settings/profile" },
  { title: "Event branding", description: "Choose an event and manage its public colors and images.", icon: Settings2, href: "/branding" },
  { title: "AI assistant provider", description: "Configure supported AI providers and model access.", icon: Bot, href: "/settings/ai" },
  { title: "Team and role access", description: "Manage members, permissions, invitations, and ownership.", icon: Users, href: "/team" },
  { title: "Account deletion", description: "Review the impact and schedule deletion of your account.", icon: AlertTriangle, href: "/settings/account" },
];

export default function SettingsPage() {
  return <main className="mx-auto max-w-5xl space-y-6 pb-16 text-content"><header><h1 className="text-2xl font-bold">Workspace settings</h1><p className="mt-1 text-sm text-content-secondary">Open a settings area to manage a functional part of AwardOS.</p></header><nav aria-label="Workspace settings" className="grid grid-cols-1 gap-4 md:grid-cols-2">{sections.map((section) => { const Icon = section.icon; return <Link key={section.href} href={section.href} className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface p-5 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span className="flex items-center gap-4"><span className="rounded-md bg-surface-raised p-3 text-accent"><Icon className="size-5" aria-hidden="true" /></span><span><span className="block text-sm font-semibold">{section.title}</span><span className="mt-1 block text-xs text-content-secondary">{section.description}</span></span></span><ChevronRight className="size-4 text-content-secondary" aria-hidden="true" /></Link>; })}</nav></main>;
}

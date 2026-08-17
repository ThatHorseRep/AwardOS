"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { switchWorkspaceAction } from "@/actions/workspaces";

type Workspace = { id: string; name: string; slug: string; type: "PERSONAL" | "ORGANIZATION" };

export function WorkspaceSwitcher({ workspaces, selectedId }: { workspaces: Workspace[]; selectedId: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const selected = workspaces.find((workspace) => workspace.id === selectedId) ?? workspaces[0];
  if (!selected) return null;
  async function choose(id: string) {
    if (id === selected.id) return setOpen(false);
    setSaving(true);
    try { await switchWorkspaceAction(id); window.location.reload(); } finally { setSaving(false); }
  }
  return <div className="relative"><button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex max-w-56 items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-left text-xs font-semibold text-content"><span className="min-w-0 truncate">{selected.name}</span>{saving ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronsUpDown className="size-3.5 text-content-muted" />}</button>{open && <div role="listbox" className="absolute left-0 top-full z-50 mt-2 min-w-56 overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-xl">{workspaces.map((workspace) => <button key={workspace.id} type="button" role="option" aria-selected={workspace.id === selected.id} onClick={() => void choose(workspace.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-surface-raised"><span className="truncate">{workspace.name}</span>{workspace.id === selected.id && <Check className="size-3.5 text-accent" />}</button>)}</div>}</div>;
}

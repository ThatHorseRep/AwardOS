"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Check, History, Inbox, Pencil, Plus, Sparkles, Trash2, UserCheck, Users, X } from "lucide-react";
import { approveSuggestionAction, getEventNominationsAction, rejectSuggestionAction } from "@/actions/nominations";
import { createNomineeAction, deactivateNomineeAction, deleteNomineeAction, getEventCategoriesAction, moveNomineeToCategoryAction, reorderNomineesAction, updateNomineeAction } from "@/actions/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

type Data = Awaited<ReturnType<typeof getEventNominationsAction>>;
type Category = Awaited<ReturnType<typeof getEventCategoriesAction>>[number];
type Nominee = Data["nominees"][number];
type Tab = "submissions" | "nominees" | "suggestions" | "history";

export default function EventNominationsPage() {
  const eventId = useParams<{ id: string }>().id;
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<Tab>("nominees");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Nominee | "new" | null>(null);
  const [removing, setRemoving] = useState<Nominee | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextData, nextCategories] = await Promise.all([
        getEventNominationsAction(eventId),
        getEventCategoriesAction(eventId),
      ]);
      setData(nextData);
      setCategories(nextCategories);
    } catch {
      setError("We could not load this event's nomination records. Try again.");
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => categories.map((category) => ({
    category,
    nominees: (data?.nominees ?? []).filter((nominee) => nominee.categoryId === category.id),
  })), [categories, data]);

  function openEditor(nominee: Nominee | "new", initialCategoryId?: string) {
    setEditing(nominee);
    setName(nominee === "new" ? "" : nominee.name);
    setBio(nominee === "new" ? "" : nominee.bio ?? "");
    setCategoryId(nominee === "new" ? initialCategoryId ?? categories[0]?.id ?? "" : nominee.categoryId);
  }

  async function saveNominee() {
    if (!name.trim() || !categoryId) return;
    setBusy("save");
    try {
      if (editing === "new") {
        await createNomineeAction(eventId, categoryId, { name, bio });
      } else if (editing) {
        await updateNomineeAction(eventId, editing.id, { name, bio });
        if (categoryId !== editing.categoryId) await moveNomineeToCategoryAction(eventId, editing.id, categoryId);
      }
      setEditing(null);
      await load();
      toast.success("Nominee saved.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "We could not save this nominee.");
    } finally { setBusy(null); }
  }

  async function removeNominee(permanent: boolean) {
    if (!removing) return;
    setBusy("remove");
    try {
      if (permanent) await deleteNomineeAction(eventId, removing.id);
      else await deactivateNomineeAction(eventId, removing.id);
      setRemoving(null);
      await load();
      toast.success(permanent ? "Nominee deleted." : "Nominee removed from the ballot.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "We could not remove this nominee.");
    } finally { setBusy(null); }
  }

  async function moveWithin(category: Category, nominee: Nominee, direction: -1 | 1) {
    const list = grouped.find((group) => group.category.id === category.id)?.nominees ?? [];
    const index = list.findIndex((item) => item.id === nominee.id);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(nominee.id);
    try { await reorderNomineesAction(eventId, category.id, ids); await load(); }
    catch { toast.error("We could not reorder these nominees."); }
    finally { setBusy(null); }
  }

  async function reviewSuggestion(text: string, approve: boolean) {
    setBusy(text);
    try {
      if (approve) await approveSuggestionAction(eventId, text, text);
      else await rejectSuggestionAction(eventId, text);
      await load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "We could not review this suggestion."); }
    finally { setBusy(null); }
  }

  if (!data && !error) return <div className="min-h-80 animate-pulse rounded-xl bg-surface-muted" aria-label="Loading nomination records" />;

  return <main className="mx-auto max-w-7xl space-y-6 pb-16 text-content">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <Link href={`/events/${eventId}`}><Button variant="ghost" size="icon" aria-label="Back to event"><ArrowLeft className="size-4" /></Button></Link>
        <div><h1 className="text-2xl font-bold">Nomination review</h1><p className="mt-1 text-sm text-content-secondary">{data?.event.name}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/events/${eventId}/ai-cleanup`}><Button variant="outline"><Sparkles className="mr-2 size-4" />Review cleanup</Button></Link>
        <Link href={`/events/${eventId}/ballot-preview`}><Button variant="primary"><UserCheck className="mr-2 size-4" />Preview ballot</Button></Link>
      </div>
    </header>

    {error && <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm"><p>{error}</p><Button className="mt-3" variant="outline" onClick={() => void load()}>Try again</Button></div>}

    <nav aria-label="Nomination views" className="flex gap-1 overflow-x-auto border-b border-border-subtle">
      {([
        ["submissions", "Raw submissions", Inbox], ["nominees", "Manage nominees", Users], ["suggestions", "Suggested categories", Sparkles], ["history", "Submission history", History],
      ] as const).map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${tab === id ? "border-accent text-accent" : "border-transparent text-content-secondary hover:text-content"}`}><Icon className="size-4" />{label}</button>)}
    </nav>

    {tab === "submissions" && <RecordList records={(data?.rawNominations ?? []).filter((item) => item.isLatest)} empty="No nominations have been submitted for this event." />}

    {tab === "history" && <RecordList records={data?.rawNominations ?? []} empty="No submission history exists for this event." showHistory />}

    {tab === "nominees" && <section className="space-y-4">
      <div className="flex justify-end"><Button variant="primary" onClick={() => openEditor("new")} disabled={categories.length === 0}><Plus className="mr-2 size-4" />Add nominee</Button></div>
      {grouped.map(({ category, nominees }) => <Card key={category.id}>
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle>{category.name}</CardTitle><p className="mt-1 text-sm text-content-secondary">{nominees.length} nominees</p></div><Button variant="outline" size="sm" onClick={() => openEditor("new", category.id)}><Plus className="mr-2 size-4" />Add</Button></CardHeader>
        <CardContent>{nominees.length === 0 ? <p className="py-6 text-sm text-content-secondary">No nominees are assigned to this category.</p> : <ul className="divide-y divide-border-subtle">{nominees.map((nominee, index) => <li key={nominee.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="font-semibold">{nominee.name}</span><Badge variant={nominee.status === "ACTIVE" ? "success" : "neutral"}>{nominee.status.toLowerCase()}</Badge></div><p className="mt-1 text-sm text-content-secondary">{nominee.nominationCount ?? 0} source nominations</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Move ${nominee.name} up`} disabled={index === 0 || busy === nominee.id} onClick={() => void moveWithin(category, nominee, -1)}><ArrowUp className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Move ${nominee.name} down`} disabled={index === nominees.length - 1 || busy === nominee.id} onClick={() => void moveWithin(category, nominee, 1)}><ArrowDown className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Edit ${nominee.name}`} onClick={() => openEditor(nominee)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Remove ${nominee.name}`} onClick={() => setRemoving(nominee)}><Trash2 className="size-4" /></Button></div></li>)}</ul>}</CardContent>
      </Card>)}
      {categories.length === 0 && <p className="rounded-lg border border-border-subtle p-6 text-sm text-content-secondary">Create an event category before adding nominees.</p>}
    </section>}

    {tab === "suggestions" && <section className="space-y-3">{(data?.suggestedCategories ?? []).filter((item) => item.status === "PENDING").map((item) => <Card key={item.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{item.suggestionText}</p><p className="text-sm text-content-secondary">Submitted {new Date(item.createdAt).toLocaleString()}</p></div><div className="flex gap-2"><Button variant="primary" size="sm" disabled={busy === item.suggestionText} onClick={() => void reviewSuggestion(item.suggestionText, true)}><Check className="mr-2 size-4" />Approve</Button><Button variant="outline" size="sm" disabled={busy === item.suggestionText} onClick={() => void reviewSuggestion(item.suggestionText, false)}><X className="mr-2 size-4" />Reject</Button></div></CardContent></Card>)}{!(data?.suggestedCategories ?? []).some((item) => item.status === "PENDING") && <p className="rounded-lg border border-border-subtle p-6 text-sm text-content-secondary">No category suggestions await review.</p>}</section>}

    <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add nominee" : "Edit nominee"} footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" disabled={busy === "save" || !name.trim() || !categoryId} onClick={() => void saveNominee()}>Save nominee</Button></div>}><div className="space-y-4"><label className="block text-sm font-medium">Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2" /></label><label className="block text-sm font-medium">Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2">{categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="block text-sm font-medium">Biography<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={2000} rows={4} className="mt-1 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2" /></label></div></Modal>

    <Modal open={removing !== null} onClose={() => setRemoving(null)} title={`Remove ${removing?.name ?? "nominee"}`} description="Deactivation preserves history. Permanent deletion is available only before ballots reference this nominee." footer={<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="outline" disabled={busy === "remove"} onClick={() => void removeNominee(false)}>Deactivate</Button><Button variant="danger" disabled={busy === "remove"} onClick={() => void removeNominee(true)}>Delete permanently</Button></div>}><p className="text-sm text-content-secondary">Choose deactivation when this nominee should disappear from the ballot but remain in historical records.</p></Modal>
  </main>;
}

function RecordList({ records, empty, showHistory = false }: { records: Data["rawNominations"]; empty: string; showHistory?: boolean }) {
  if (records.length === 0) return <p className="rounded-lg border border-border-subtle p-6 text-sm text-content-secondary">{empty}</p>;
  return <Card><CardContent className="p-0"><ul className="divide-y divide-border-subtle">{records.map((item) => <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{item.nomineeText}</p><p className="text-sm text-content-secondary">{item.categoryName}</p></div><div className="text-sm text-content-secondary sm:text-right">{showHistory && <p>Submission {item.submissionNumber ?? 1} · {item.isLatest ? "latest" : "superseded"}</p>}<time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleString()}</time></div></li>)}</ul></CardContent></Card>;
}

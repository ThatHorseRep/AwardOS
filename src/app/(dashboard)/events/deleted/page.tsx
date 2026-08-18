"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { getDeletedEventsAction, purgeDeletedEventAction, restoreDeletedEventAction } from "@/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { LoadError } from "@/components/shared/load-error";

type DeletedEvent = Awaited<ReturnType<typeof getDeletedEventsAction>>[number];

export default function DeletedEventsPage() {
  const toast = useToast();
  const [events, setEvents] = useState<DeletedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [purging, setPurging] = useState<DeletedEvent | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const load = useCallback(async () => { try { setLoadError(false); setLoading(true); setEvents(await getDeletedEventsAction()); } catch { setLoadError(true); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  async function restore(eventId: string) { try { await restoreDeletedEventAction(eventId); await load(); toast.success("Event restored."); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "We could not restore this event."); } }
  async function purge() { if (!purging) return; try { await purgeDeletedEventAction(purging.id, confirmation); setPurging(null); setConfirmation(""); await load(); toast.success("Event permanently deleted."); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "We could not delete this event."); } }

  return <main className="mx-auto max-w-5xl space-y-6 pb-16"><header className="flex items-start gap-3"><Link href="/events"><Button variant="ghost" size="icon" aria-label="Back to events"><ArrowLeft className="size-4" /></Button></Link><div><h1 className="text-2xl font-bold text-content">Deleted events</h1><p className="mt-1 text-sm text-content-secondary">Restore events for 30 days before permanent deletion becomes available.</p></div></header>
    {loadError ? <LoadError onRetry={() => void load()} /> : loading ? <div className="min-h-48 animate-pulse rounded-xl bg-surface-muted" /> : events.length === 0 ? <p className="rounded-lg border border-border-subtle p-6 text-sm text-content-secondary">No deleted events are awaiting recovery.</p> : <section className="space-y-3">{events.map((event) => { const recoverUntil = new Date(event.deletedAt!.getTime() + 30 * 86400000); const expired = recoverUntil.getTime() <= Date.now(); return <Card key={event.id}><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-content">{event.name}</p><p className="mt-1 text-sm text-content-secondary">{expired ? "Recovery window expired" : `Recoverable until ${recoverUntil.toLocaleString()}`}</p></div><div className="flex gap-2">{!expired && <Button variant="outline" onClick={() => void restore(event.id)}><RotateCcw className="mr-2 size-4" />Restore</Button>}<Button variant="danger" disabled={!expired} title={expired ? "Permanently delete event" : "Available after the recovery window"} onClick={() => { setPurging(event); setConfirmation(""); }}><Trash2 className="mr-2 size-4" />Delete permanently</Button></div></CardContent></Card>; })}</section>}
    <Modal open={purging !== null} onClose={() => setPurging(null)} title="Permanently delete event" description="This removes the event, ballots, nominations, results, and related records. This action cannot be undone." footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPurging(null)}>Cancel</Button><Button variant="danger" disabled={confirmation !== purging?.name} onClick={() => void purge()}>Delete permanently</Button></div>}><label className="block text-sm font-medium">Enter <strong>{purging?.name}</strong> to confirm<Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2" /></label></Modal>
  </main>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getArchiveConfigAction, getNomineePrivacyRequestsAction, resolveNomineePrivacyRequestAction, updateArchiveConfigAction, type ArchiveConfigInput } from "@/actions/archive";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { LoadError } from "@/components/shared/load-error";

const defaults: ArchiveConfigInput = { showWinners: true, showNominees: false, showStatistics: false, showOrganizers: false, showPhotos: false, showHighlights: false, isPublic: false };
const fields: Array<[keyof ArchiveConfigInput, string]> = [["showWinners", "Show official winners"], ["showNominees", "Show nominee roster"], ["showStatistics", "Show published statistics"], ["showOrganizers", "Show organizer names"], ["showPhotos", "Show nominee photos"], ["showHighlights", "Show event highlights"], ["isPublic", "List this event in the public archive"]];

export default function ArchiveSettingsPage() {
  const { id } = useParams<{ id: string }>(); const toast = useToast();
  const [config, setConfig] = useState<ArchiveConfigInput | null>(null); const [requests, setRequests] = useState<Awaited<ReturnType<typeof getNomineePrivacyRequestsAction>>>([]); const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => { try { setLoadError(false); const [value, privacy] = await Promise.all([getArchiveConfigAction(id), getNomineePrivacyRequestsAction(id)]); setConfig(value ? { showWinners: Boolean(value.showWinners), showNominees: Boolean(value.showNominees), showStatistics: Boolean(value.showStatistics), showOrganizers: Boolean(value.showOrganizers), showPhotos: Boolean(value.showPhotos), showHighlights: Boolean(value.showHighlights), isPublic: Boolean(value.isPublic) } : defaults); setRequests(privacy); } catch { setLoadError(true); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (loadError) return <LoadError onRetry={() => void load()} />;
  if (!config) return <div className="p-8 text-sm text-content-secondary">Loading archive settings...</div>;
  async function save() { if (!config) return; setSaving(true); try { await updateArchiveConfigAction(id, config); toast.success("Archive settings saved."); } catch (error) { toast.error(error instanceof Error ? error.message : "We could not save archive settings."); } finally { setSaving(false); } }
  async function resolve(requestId: string, approve: boolean) { try { await resolveNomineePrivacyRequestAction(requestId, approve, approve ? "Approved by event administrator." : "Request declined after review."); await load(); toast.success("Privacy request updated."); } catch (error) { toast.error(error instanceof Error ? error.message : "We could not update this request."); } }
  return <main className="mx-auto max-w-3xl space-y-6"><header><h1 className="text-2xl font-bold text-content">Archive settings</h1><p className="text-sm text-content-secondary">Choose what remains visible after the event closes. Public listing is opt in.</p></header><Card><CardHeader><CardTitle>Archive visibility</CardTitle></CardHeader><CardContent className="space-y-4">{fields.map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 border-b border-border-subtle py-3 text-sm"><span>{label}</span><input type="checkbox" checked={config[key]} onChange={(event) => setConfig({ ...config, [key]: event.target.checked })} /></label>)}<Button disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save archive settings"}</Button></CardContent></Card><Card><CardHeader><CardTitle>Nominee privacy requests</CardTitle></CardHeader><CardContent className="space-y-3">{requests.length === 0 ? <p className="text-sm text-content-secondary">No privacy requests.</p> : requests.map((request) => <div key={request.id} className="rounded-lg border border-border-subtle p-4 text-sm"><div className="font-semibold">{request.requestType} · {request.status}</div><p className="mt-1 text-content-secondary">{request.reason}</p>{request.status === "PENDING" && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void resolve(request.id, true)}>Approve</Button><Button size="sm" variant="outline" onClick={() => void resolve(request.id, false)}>Reject</Button></div>}</div>)}</CardContent></Card></main>;
}

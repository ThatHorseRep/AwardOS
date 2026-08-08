"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Lock,
  Globe,
  Smartphone,
  Check,
  Plus,
  Loader2,
  Trash2,
  HelpCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventDetailsAction } from "@/actions/events";
import {
  triggerIntegrityScanAction,
  getIntegrityAlertsAction,
  getEventVoteSessionsAction,
  resolveAlertAction,
  quarantineSessionsAction,
  restoreSessionsAction,
} from "@/actions/integrity";

export default function VotingIntegrityDashboardPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<any | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ scanned: number; alerts: number } | null>(null);

  // Resolution Modal / Form State
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [resolutionAction, setResolutionAction] = useState<"RESOLVE" | "DISMISS">("RESOLVE");
  const [resolutionNote, setResolutionNote] = useState("");
  const [submittingResolution, setSubmittingResolution] = useState(false);

  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);

  // UI State: track which alerts have expanded detail panels
  const [expandedAlerts, setExpandedAlerts] = useState<{ [alertId: string]: boolean }>({});

  const loadData = async () => {
    try {
      const eventDetails = await getEventDetailsAction(eventId);
      setEvent(eventDetails);

      const alertList = await getIntegrityAlertsAction(eventId);
      setAlerts(alertList);

      const sessionList = await getEventVoteSessionsAction(eventId);
      setSessions(sessionList);
    } catch (err) {
      console.error("Failed to load integrity page details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  const toggleExpandAlert = (alertId: string) => {
    setExpandedAlerts((prev) => ({
      ...prev,
      [alertId]: !prev[alertId],
    }));
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await triggerIntegrityScanAction(eventId);
      if (result.success) {
        setScanResult({
          scanned: result.scannedCount || 0,
          alerts: result.alertsCreated || 0,
        });
        await loadData();
      }
    } catch (err) {
      console.error("Failed to trigger audit scan:", err);
      alert("Error executing integrity audit.");
    } finally {
      setScanning(false);
    }
  };

  const openResolution = (alert: any, action: "RESOLVE" | "DISMISS") => {
    setSelectedAlert(alert);
    setResolutionAction(action);
    setResolutionNote("");
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert || !resolutionNote.trim()) return;
    setSubmittingResolution(true);

    try {
      // If resolving as VALIDATE/DISQUALIFY, gather session IDs from affectedVotes
      const affected = selectedAlert.affectedVotes as any;
      const disqualifySessions =
        resolutionAction === "RESOLVE" && affected && affected.sessionIds
          ? affected.sessionIds
          : [];

      await resolveAlertAction(selectedAlert.id, {
        status: resolutionAction === "RESOLVE" ? "RESOLVED" : "DISMISSED",
        note: resolutionNote.trim(),
        disqualifySessions,
      });

      setSelectedAlert(null);
      await loadData();
    } catch (err) {
      console.error("Failed to resolve alert:", err);
      alert("Error submitting resolution.");
    } finally {
      setSubmittingResolution(false);
    }
  };

  const handleFlagSession = async (sessionId: string) => {
    setSessionActionLoading(true);
    setProcessingSessionId(sessionId);

    try {
      await quarantineSessionsAction([sessionId]);
      await loadData();
    } catch (err) {
      console.error("Failed to flag session:", err);
      alert("Error flagging vote session.");
    } finally {
      setProcessingSessionId(null);
      setSessionActionLoading(false);
    }
  };

  const handleRestoreSession = async (sessionId: string) => {
    setSessionActionLoading(true);
    setProcessingSessionId(sessionId);

    try {
      await restoreSessionsAction([sessionId]);
      await loadData();
    } catch (err) {
      console.error("Failed to restore session:", err);
      alert("Error restoring vote session.");
    } finally {
      setProcessingSessionId(null);
      setSessionActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12 text-slate-300">
        <h2 className="text-xl font-bold text-white">Event not found</h2>
        <Link href="/events" className="mt-4 inline-block text-indigo-400 hover:underline">
          Back to Events
        </Link>
      </div>
    );
  }

  // Summary counts
  const totalVotesCount = sessions.length;
  const activeAlerts = alerts.filter((a) => a.status === "NEW");
  const activeAlertsCount = activeAlerts.length;
  const disqualifiedCount = sessions.filter((s) => s.status === "INVALIDATED").length;
  const flaggedCount = sessions.filter((s) => s.status === "FLAGGED").length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-12">
      {/* Header Back navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Voting Integrity Dashboard</span>
              {activeAlertsCount > 0 ? (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              ) : null}
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Monitor, audit, and investigate voting anomalies for <strong className="text-slate-300">{event.name}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={scanning}
            onClick={handleScan}
            className="border-slate-800 text-slate-200 hover:bg-slate-900/60"
          >
            {scanning ? (
              <Loader2 className="animate-spin w-4 h-4 mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            <span>Run Integrity Audit</span>
          </Button>
        </div>
      </div>

      {scanResult && (
        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-300">
              Audit scan completed! Scanned <strong className="text-white">{scanResult.scanned}</strong> ballot sessions. Identified <strong className="text-rose-400">{scanResult.alerts}</strong> new anomalies.
            </span>
          </div>
          <button onClick={() => setScanResult(null)} className="text-slate-500 hover:text-white">✕</button>
        </div>
      )}

      {/* Stats indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Scanned Ballots</span>
            <div className="text-2xl font-bold text-white mt-1">{totalVotesCount}</div>
            <span className="text-[10px] text-slate-400 mt-1 block">Active ballot sessions submitted</span>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Active Integrity Alerts</span>
            <div className="text-2xl font-bold mt-1 text-rose-400">{activeAlertsCount}</div>
            <span className="text-[10px] text-slate-400 mt-1 block">Unresolved security alerts pending</span>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Disqualified Ballots</span>
            <div className="text-2xl font-bold mt-1 text-slate-400">{disqualifiedCount}</div>
            <span className="text-[10px] text-slate-400 mt-1 block">Excluded from results calculations</span>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Flagged Sessions</span>
            <div className="text-2xl font-bold mt-1 text-amber-300">{flaggedCount}</div>
            <span className="text-[10px] text-slate-400 mt-1 block">Manually reviewed or suspicious vote sessions</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts listing column */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider block px-1">Active Alerts Feed ({activeAlertsCount})</h2>
          
          {activeAlertsCount === 0 ? (
            <Card className="border-slate-800 bg-slate-950/10 p-12 text-center text-slate-500 text-xs">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <span>No active integrity alerts. Run an audit to scan for duplicate submissions or IP clusters.</span>
            </Card>
          ) : (
            activeAlerts.map((alert) => {
              const isExpanded = !!expandedAlerts[alert.id];
              const affected = alert.affectedVotes as any;

              return (
                <Card key={alert.id} className="border-slate-800 bg-slate-950/20 overflow-hidden">
                  <div className="p-5 flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      alert.severity === "CRITICAL"
                        ? "bg-rose-500/10 text-rose-400"
                        : alert.severity === "WARNING"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-white truncate">{alert.title}</h3>
                        <Badge
                          variant={
                            alert.severity === "CRITICAL"
                              ? "danger"
                              : alert.severity === "WARNING"
                              ? "warning"
                              : "default"
                          }
                          size="sm"
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{alert.description}</p>

                      <div className="flex items-center justify-between pt-3">
                        <button
                          onClick={() => toggleExpandAlert(alert.id)}
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 focus:outline-none"
                        >
                          {isExpanded ? (
                            <>
                              <span>Hide Affected Ballots</span>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              <span>Show Affected Ballots ({affected?.sessionIds?.length || 0})</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openResolution(alert, "DISMISS")}
                            className="text-slate-400 hover:text-white h-7 text-[11px] px-2.5"
                          >
                            Dismiss
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResolution(alert, "RESOLVE")}
                            className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 h-7 text-[11px] px-2.5"
                          >
                            Resolve Alert
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const note = window.prompt("Optional acknowledgement note:") || "";
                                const { acknowledgeAlertAction } = await import("@/actions/integrity");
                                await acknowledgeAlertAction(alert.id, note.trim());
                                await loadData();
                              } catch (err) {
                                console.error("Failed to acknowledge alert:", err);
                                alert("Error acknowledging alert.");
                              }
                            }}
                            className="text-slate-400 hover:text-white h-7 text-[11px] px-2.5"
                          >
                            Acknowledge
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail list of ballots */}
                  {isExpanded && affected && affected.sessionIds && (
                    <div className="px-5 pb-5 border-t border-slate-800/80 bg-slate-900/10 pt-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase block">Affected Vote Sessions</div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {sessions
                          .filter((s) => affected.sessionIds.includes(s.id))
                          .map((s) => (
                            <div key={s.id} className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] text-slate-400">{s.id.substring(0, 8)}...</span>
                                  {s.verifiedEmail && (
                                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-md font-medium">{s.verifiedEmail}</span>
                                  )}
                                  {s.invitationCode && (
                                    <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-md font-mono">{s.invitationCode}</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                  <Globe className="w-3 h-3 text-slate-600" />
                                  <span>IP: {s.ipAddress || "Unknown"}</span>
                                  <span>•</span>
                                  <span>Browser: {s.userAgent ? s.userAgent.substring(0, 24) : "Unknown"}...</span>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono self-start sm:self-center">
                                {s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString() : ""}
                              </span>
                            </div>
                          ))}
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                        <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>Recommendation:</strong> {alert.recommendation}
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}

          {/* Resolved Alerts Audit log */}
          {alerts.filter((a) => a.status !== "NEW").length > 0 && (
            <div className="space-y-3 pt-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider block px-1">Resolution Audit Log</h2>
              <div className="space-y-3">
                {alerts
                  .filter((a) => a.status !== "NEW")
                  .map((alert) => (
                    <Card key={alert.id} className="border-slate-800 bg-slate-950/10 opacity-70 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-xs font-bold text-white">{alert.title}</h4>
                        <Badge variant="neutral" className="border-emerald-500/20 text-emerald-400 text-[10px]">
                          {alert.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">{alert.description}</p>
                      <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 space-y-1">
                        <div>
                          Resolved Note: <span className="text-slate-300 italic">&quot;{alert.resolutionNote || "None"}&quot;</span>
                        </div>
                        <div>
                          Resolved by: <span className="text-white">{alert.resolvedByName || "System"}</span>
                        </div>
                        <div>
                          Resolved at: <span>{alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : ""}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info / Vote sessions listing */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider block px-1">Vote Sessions Registry</h2>
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold">Latest Submissions</CardTitle>
            </CardHeader>
            <CardContent className="px-3">
              {sessions.length === 0 ? (
                <div className="text-center text-slate-500 text-[11px] py-8 italic">No vote sessions logged.</div>
              ) : (
                <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                  {sessions.slice(0, 50).map((s) => (
                    <div key={s.id} className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-850 flex flex-col gap-3 text-[11px] lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-slate-400 text-[10px]">{s.id.substring(0, 8)}...</span>
                          <Badge
                            variant={
                              s.status === "SUBMITTED"
                                ? "success"
                                : s.status === "INVALIDATED"
                                ? "danger"
                                : s.status === "FLAGGED"
                                ? "warning"
                                : "default"
                            }
                            size="sm"
                            className="text-[9px]"
                          >
                            {s.status}
                          </Badge>
                        </div>
                        {s.verifiedEmail && (
                          <div className="text-slate-300 font-medium truncate">{s.verifiedEmail}</div>
                        )}
                        {s.invitationCode && (
                          <div className="text-slate-300 font-mono font-medium truncate">{s.invitationCode}</div>
                        )}
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          IP: {s.ipAddress || "127.0.0.1"}
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className="text-[9px] text-slate-500 whitespace-nowrap">
                          {s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString() : ""}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {s.status === "SUBMITTED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFlagSession(s.id)}
                              disabled={sessionActionLoading && processingSessionId === s.id}
                              className="h-7 px-2 text-[10px]"
                            >
                              {sessionActionLoading && processingSessionId === s.id ? (
                                <Loader2 className="animate-spin w-3 h-3" />
                              ) : (
                                "Flag"
                              )}
                            </Button>
                          )}
                          {s.status === "FLAGGED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestoreSession(s.id)}
                              disabled={sessionActionLoading && processingSessionId === s.id}
                              className="h-7 px-2 text-[10px]"
                            >
                              {sessionActionLoading && processingSessionId === s.id ? (
                                <Loader2 className="animate-spin w-3 h-3" />
                              ) : (
                                "Restore"
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resolution Sheet/Modal Overlay */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  {resolutionAction === "RESOLVE" ? "Resolve Integrity Alert" : "Dismiss Integrity Alert"}
                </h3>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {resolutionAction === "RESOLVE" ? (
                <span>
                  Resolving this alert will change its status to <strong className="text-white">RESOLVED</strong> and automatically <strong className="text-rose-400">DISQUALIFY</strong> all affected vote sessions ({selectedAlert.affectedVotes?.sessionIds?.length || 0} ballots).
                </span>
              ) : (
                <span>
                  Dismissing this alert will mark it as <strong className="text-white">DISMISSED</strong>. No votes will be disqualified or changed.
                </span>
              )}
            </p>

            <form onSubmit={handleResolve} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">Audit / Resolution Note (Required)</label>
                <textarea
                  required
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Explain the decision context for the audit logs..."
                  className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="button" variant="outline" size="md" onClick={() => setSelectedAlert(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submittingResolution || !resolutionNote.trim()}
                  className={`flex-1 text-white ${
                    resolutionAction === "RESOLVE" ? "bg-rose-600 hover:bg-rose-500" : "bg-indigo-600 hover:bg-indigo-500"
                  }`}
                >
                  {submittingResolution ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  ) : null}
                  <span>Confirm Resolution</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

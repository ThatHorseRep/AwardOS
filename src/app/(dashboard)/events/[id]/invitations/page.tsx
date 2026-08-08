"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Key,
  ShieldCheck,
  Plus,
  Loader2,
  Trash2,
  Lock,
  Calendar,
  Layers,
  Sparkles,
  Download,
  Search,
  Filter,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  generateInvitationCodesAction,
  getInvitationCodesAction,
  revokeInvitationCodeAction,
} from "@/actions/voting";
import { getAppOrigin } from "@/lib/app-url";
import { getEventDetailsAction } from "@/actions/events";

import { useToast } from "@/components/ui/toast";
export default function InvitationCodesPanelPage() {
  const toast = useToast();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<any | null>(null);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNUSED" | "USED" | "REVOKED">("ALL");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [generateCount, setGenerateCount] = useState(25);
  const [codePrefix, setCodePrefix] = useState("");
  const [expiresDays, setExpiresDays] = useState(30);

  const loadData = async () => {
    try {
      const eventDetails = await getEventDetailsAction(eventId);
      setEvent(eventDetails);

      const codesList = await getInvitationCodesAction(eventId);
      setCodes(codesList);
    } catch (err) {
      console.error("Failed to load invitation codes details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generateCount < 1 || generateCount > 500) return;
    setGenerating(true);
    try {
      const result = await generateInvitationCodesAction(eventId, generateCount, {
        prefix: codePrefix.trim(),
        expiresDays,
      });
      if (result.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Failed to generate codes:", err);
      toast.error("Error generating invitation codes");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (codeId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation code? It will no longer be eligible to vote.")) return;
    setRevokingId(codeId);
    try {
      const result = await revokeInvitationCodeAction(codeId);
      if (result.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Failed to revoke code:", err);
      toast.error("Error revoking code");
    } finally {
      setRevokingId(null);
    }
  };

  const handleExportCSV = () => {
    if (!event || codes.length === 0) return;
    const origin = getAppOrigin();
    const headers = ["Invitation Code", "Status", "Direct Voting Link", "Created At", "Expires At"];

    const rows = filteredCodes.map((c) => [
      c.code,
      c.status,
      `"${origin}/e/${event.slug}/vote?code=${c.code}"`,
      `"${new Date(c.createdAt).toLocaleDateString()}"`,
      `"${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.name.replace(/\s+/g, "_")}_Voter_PINs.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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

  const unusedCount = codes.filter((c) => c.status === "UNUSED").length;
  const usedCount = codes.filter((c) => c.status === "USED").length;
  const revokedCount = codes.filter((c) => c.status === "REVOKED").length;

  const filteredCodes = codes.filter((c) => {
    const matchesSearch = c.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}?tab=settings`}>
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Event Voter PINs & Invitation Codes</span>
              <Badge variant="purple" size="sm">
                {codes.length} Total
              </Badge>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Generate, export, and track single-use credentials for voter authentication in <strong className="text-slate-300">{event.name}</strong>.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={codes.length === 0}
          className="border-slate-800 text-slate-200 hover:bg-slate-900"
        >
          <Download className="w-4 h-4 mr-2" />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Generated</span>
            <div className="text-2xl font-bold text-white mt-1">{codes.length}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Unused / Active</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{unusedCount}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Used Votes</span>
            <div className="text-2xl font-bold text-indigo-400 mt-1">{usedCount}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Revoked</span>
            <div className="text-2xl font-bold text-slate-500 mt-1">{revokedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: generator + listing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Code Generator form */}
        <div>
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-400" />
                <CardTitle className="text-sm font-bold">Batch Code Generator</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Create custom batches of single-use voter authentication PINs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Quantity (1 - 500)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={generateCount}
                    onChange={(e) => setGenerateCount(parseInt(e.target.value) || 25)}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Code Prefix Tag (Optional)</label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="e.g. VIP, FACULTY"
                    value={codePrefix}
                    onChange={(e) => setCodePrefix(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-purple-500 font-mono uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Expiration Schedule</label>
                  <select
                    value={expiresDays}
                    onChange={(e) => setExpiresDays(parseInt(e.target.value))}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none"
                  >
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={0}>Never Expire</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white"
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  <span>Generate {generateCount} Voter PINs</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Listing Panel */}
        <div className="lg:col-span-2">
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-sm font-bold">Active Codes Registry</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search PIN code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-900 text-slate-200 text-[11px] rounded-lg pl-8 pr-2.5 py-1.5 border border-slate-800 focus:outline-none focus:border-purple-500 font-mono w-36"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="bg-slate-900 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 border border-slate-800 focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="UNUSED">Unused</option>
                    <option value="USED">Used</option>
                    <option value="REVOKED">Revoked</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredCodes.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No matching invitation codes found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-medium">
                        <th className="py-3 font-semibold">Code PIN</th>
                        <th className="py-3 font-semibold">Status</th>
                        <th className="py-3 font-semibold">Expires</th>
                        <th className="py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCodes.map((c) => {
                        const isUnused = c.status === "UNUSED";
                        const isRevoking = revokingId === c.id;

                        return (
                          <tr key={c.id} className="border-b border-slate-800/60 hover:bg-slate-900/10">
                            <td className="py-3.5 font-mono font-bold text-white text-sm flex items-center gap-2">
                              <span>{c.code}</span>
                              <button
                                onClick={() => handleCopyCode(c.code)}
                                className="text-slate-500 hover:text-slate-200 transition-colors"
                              >
                                {copiedCode === c.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                            <td className="py-3.5">
                              <Badge
                                variant={
                                  c.status === "UNUSED"
                                    ? "success"
                                    : c.status === "USED"
                                    ? "info"
                                    : "default"
                                }
                                size="sm"
                              >
                                {c.status}
                              </Badge>
                            </td>
                            <td className="py-3.5 text-slate-400 text-[11px]">
                              {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                            </td>
                            <td className="py-3.5 text-right">
                              {isUnused && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isRevoking}
                                  onClick={() => handleRevoke(c.id)}
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-7 px-2.5"
                                >
                                  {isRevoking ? (
                                    <Loader2 className="animate-spin w-3.5 h-3.5" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

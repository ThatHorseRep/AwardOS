"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Award, Download, Printer, Eye, LoaderCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadError } from "@/components/shared/load-error";
import { generateCertificateSVG } from "@/lib/certificates/template";
import { getPublishedCertificateCandidatesAction } from "@/actions/results";

export default function CertificatesPage() {
  const [candidates, setCandidates] = useState<Awaited<ReturnType<typeof getPublishedCertificateCandidatesAction>>>([]);
  const [selectedId, setSelectedId] = useState("");
  const [winnerName, setWinnerName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [eventName, setEventName] = useState("");
  const [rankText, setRankText] = useState("Winner");
  const [organizationName, setOrganizationName] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toLocaleDateString());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const selected = candidates.find((candidate) => candidate.officialResultId === selectedId);

  function selectCandidate(id: string, source = candidates) {
    const candidate = source.find((row) => row.officialResultId === id);
    if (!candidate) return;
    setSelectedId(id);
    setWinnerName(candidate.winnerName);
    setCategoryName(candidate.categoryName);
    setEventName(candidate.eventName);
    setOrganizationName(candidate.eventName);
  }

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const rows = await getPublishedCertificateCandidatesAction();
      setCandidates(rows);
      const first = rows[0];
      if (first) {
        setSelectedId(first.officialResultId);
        setWinnerName(first.winnerName);
        setCategoryName(first.categoryName);
        setEventName(first.eventName);
        setOrganizationName(first.eventName);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCandidates(); }, [loadCandidates]);

  const certificateSvg = generateCertificateSVG({
    winnerName,
    categoryName,
    eventName,
    rankText,
    issueDate,
    certificateId: selected?.officialResultId ?? "",
    organizationName,
  });

  const handleDownloadSVG = () => {
    const blob = new Blob([certificateSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${winnerName.replace(/\s+/g, "_")}_Certificate.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const frame = document.createElement("iframe");
    frame.title = "Certificate print preview";
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.opacity = "0";
    frame.srcdoc = `<html><head><title>Certificate</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}svg{max-width:100%;max-height:100vh}</style></head><body>${certificateSvg}</body></html>`;
    document.body.appendChild(frame);
    frame.onload = () => { frame.contentWindow?.print(); window.setTimeout(() => frame.remove(), 1000); };
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-64 max-w-6xl items-center justify-center" aria-busy="true">
        <div role="status" className="flex items-center gap-2 text-sm text-content-secondary">
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Loading published certificate candidates...
        </div>
      </main>
    );
  }
  if (loadError) return <LoadError onRetry={() => void loadCandidates()} />;

  return (
    <main className="mx-auto max-w-6xl space-y-6 pb-16 text-content">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="gold" className="flex items-center gap-1">
              <Award className="w-3 h-3" /> Official Certificate Engine
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Winner Certificates</h1>
          <p className="mt-1 text-xs font-medium text-content-secondary">
            Generate and print certificates for published official winners.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!selected} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm font-semibold">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button variant="primary" size="sm" onClick={handleDownloadSVG} disabled={!selected} className="rounded-full bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md shadow-amber-600/20">
            <Download className="w-4 h-4 mr-2" /> Export Certificate
          </Button>
        </div>
      </div>

      {candidates.length === 0 ? (
        <section className="rounded-lg border border-border-subtle bg-surface-muted p-8 text-center" aria-live="polite">
          <Award className="mx-auto mb-3 size-7 text-content-muted" aria-hidden="true" />
          <h2 className="text-base font-semibold">No published winners yet</h2>
          <p className="mt-1 text-sm text-content-secondary">Certificates become available after an official result is published.</p>
        </section>
      ) : <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Editor Controls Column */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-white border-slate-200/80 rounded-3xl shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> Certificate Details
              </CardTitle>
              <CardDescription className="text-slate-600 text-xs font-medium">
                Customize fields live to update the certificate preview.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs pt-4">
                <label htmlFor="published-winner" className="grid gap-1.5 font-semibold text-content">
                  Published winner
                <select id="published-winner" value={selectedId} onChange={(event) => selectCandidate(event.target.value)} className="min-h-11 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
                  <option value="">Select a published winner</option>
                  {candidates.map((candidate) => <option key={candidate.officialResultId} value={candidate.officialResultId}>{candidate.eventName} - {candidate.categoryName} - {candidate.winnerName}</option>)}
                </select>
              </label>
              <div className="space-y-1.5">
                <label htmlFor="certificate-winner" className="font-semibold text-content">Recipient / Winner Name</label>
                <Input id="certificate-winner"
                  value={winnerName}
                  onChange={(e) => setWinnerName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="certificate-category" className="font-semibold text-content">Category Name</label>
                <Input id="certificate-category"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="certificate-event" className="font-semibold text-content">Event Title</label>
                <Input id="certificate-event"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="certificate-rank" className="font-semibold text-content">Award Distinction</label>
                <Input id="certificate-rank"
                  value={rankText}
                  onChange={(e) => setRankText(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="certificate-organization" className="font-semibold text-content">Issuing Body / Committee</label>
                <Input id="certificate-organization"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="certificate-date" className="font-semibold text-content">Date of Issuance</label>
                <Input id="certificate-date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live SVG Certificate Preview Area */}
        <div className="lg:col-span-8">
          <Card className="bg-white border-slate-200/80 rounded-3xl overflow-hidden p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> Live Ultra-HD Certificate Render
              </span>
              <Badge variant="gold" size="sm">
                Vector SVG 1200x850
              </Badge>
            </div>

            <div
              className="w-full rounded-2xl overflow-hidden shadow-xl border border-amber-500/30 bg-[#090d16]"
              dangerouslySetInnerHTML={{ __html: certificateSvg }}
            />
          </Card>
        </div>
      </div>}
    </main>
  );
}

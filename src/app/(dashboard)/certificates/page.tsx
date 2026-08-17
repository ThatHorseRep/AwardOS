"use client";

import React, { useEffect, useState } from "react";
import { Award, Download, Printer, Eye } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const selected = candidates.find((candidate) => candidate.officialResultId === selectedId);

  useEffect(() => {
    void getPublishedCertificateCandidatesAction().then((rows) => {
      setCandidates(rows);
      const first = rows[0];
      if (first) {
        setSelectedId(first.officialResultId);
        setWinnerName(first.winnerName);
        setCategoryName(first.categoryName);
        setEventName(first.eventName);
        setOrganizationName(first.eventName);
      }
    });
  }, []);

  function selectCandidate(id: string) {
    const candidate = candidates.find((row) => row.officialResultId === id);
    if (!candidate) return;
    setSelectedId(id);
    setWinnerName(candidate.winnerName);
    setCategoryName(candidate.categoryName);
    setEventName(candidate.eventName);
    setOrganizationName(candidate.eventName);
  }

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans select-none pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="gold" className="flex items-center gap-1">
              <Award className="w-3 h-3" /> Official Certificate Engine
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Winner Certificates</h1>
          <p className="text-slate-600 text-xs mt-1 font-medium">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
              <label className="grid gap-1.5 font-semibold text-slate-700">
                Published winner
                <select value={selectedId} onChange={(event) => selectCandidate(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <option value="">Select a published winner</option>
                  {candidates.map((candidate) => <option key={candidate.officialResultId} value={candidate.officialResultId}>{candidate.eventName} - {candidate.categoryName} - {candidate.winnerName}</option>)}
                </select>
              </label>
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Recipient / Winner Name</label>
                <input
                  type="text"
                  value={winnerName}
                  onChange={(e) => setWinnerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Category Name</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Event Title</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Award Distinction</label>
                <input
                  type="text"
                  value={rankText}
                  onChange={(e) => setRankText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Issuing Body / Committee</label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Date of Issuance</label>
                <input
                  type="text"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
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
      </div>
    </div>
  );
}

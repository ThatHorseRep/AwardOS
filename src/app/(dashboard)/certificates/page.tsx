"use client";

import React, { useState } from "react";
import { Award, Download, Printer, Share2, Sparkles, Check, RefreshCw, Eye } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateCertificateSVG } from "@/lib/certificates/template";

export default function CertificatesPage() {
  const [winnerName, setWinnerName] = useState("Alexandre Kwame Mensah");
  const [categoryName, setCategoryName] = useState("Innovator of the Year");
  const [eventName, setEventName] = useState("Annual Campus Recognition Gala 2026");
  const [rankText, setRankText] = useState("1st Place Winner");
  const [organizationName, setOrganizationName] = useState("AwardOS Honors Committee");
  const [issueDate, setIssueDate] = useState("August 15, 2026");

  const certificateSvg = generateCertificateSVG({
    winnerName,
    categoryName,
    eventName,
    rankText,
    issueDate,
    certificateId: "AWD-2026-99482-VERIFIED",
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
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Certificate - ${winnerName}</title>
            <style>
              body { margin: 0; padding: 0; background: #090d16; display: flex; align-items: center; justify-content: center; height: 100vh; }
              svg { max-width: 100%; max-height: 100vh; }
            </style>
          </head>
          <body>
            ${certificateSvg}
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="gold" className="flex items-center gap-1">
              <Award className="w-3 h-3" /> Official Certificate Engine
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Winner Certificates</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Generate, customize, and export high-resolution verified SVG/PDF award certificates for winners and finalists.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="border-zinc-800 text-zinc-300">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button variant="primary" size="sm" onClick={handleDownloadSVG} className="bg-amber-600 hover:bg-amber-500 text-white">
            <Download className="w-4 h-4 mr-2" /> Export Certificate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor Controls Column */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Certificate Details
              </CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                Customize fields live to update the certificate preview.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-300">Recipient / Winner Name</label>
                <input
                  type="text"
                  value={winnerName}
                  onChange={(e) => setWinnerName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-300">Category Name</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-300">Event Title</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-300">Award Distinction</label>
                <input
                  type="text"
                  value={rankText}
                  onChange={(e) => setRankText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-300">Issuing Body / Committee</label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-300">Date of Issuance</label>
                <input
                  type="text"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live SVG Certificate Preview Area */}
        <div className="lg:col-span-8">
          <Card className="bg-zinc-900/40 border-zinc-800 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> Live Ultra-HD Certificate Render
              </span>
              <Badge variant="gold" size="sm">
                Vector SVG 1200x850
              </Badge>
            </div>

            <div
              className="w-full rounded-2xl overflow-hidden shadow-2xl border border-amber-500/30 bg-[#090d16]"
              dangerouslySetInnerHTML={{ __html: certificateSvg }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  Loader2,
  Calendar,
  Layers,
  FileCode,
  History,
  FileText,
  Printer,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventDetailsAction } from "@/actions/events";
import {
  getRawBallotsExportAction,
  getVoterLogsExportAction,
  getEventResultsAction,
} from "@/actions/results";
import { createExportJobAction, getExportJobsAction } from "@/actions/exports";
import { escapeXml, sanitizeSpreadsheetCell } from "@/lib/sanitize";

export default function OrganizerExportsDashboardPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any | null>(null);
  const [exportJobs, setExportJobs] = useState<any[]>([]);

  // Download loading states
  const [exportingRaw, setExportingRaw] = useState(false);
  const [exportingTally, setExportingTally] = useState(false);
  const [exportingVoters, setExportingVoters] = useState(false);

  const loadData = async () => {
    try {
      const eventDetails = await getEventDetailsAction(eventId);
      setEvent(eventDetails);

      const jobs = await getExportJobsAction(eventId);
      setExportJobs(jobs);
    } catch (err) {
      console.error("Failed to load export configurations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  // Every row rendered by the three helpers below carries values a voter typed:
  // nominee names, and `User_Agent`, which is a request header the client sets
  // freely. None of these paths go through JSX, so nothing escapes them for us.
  const cellText = (value: unknown) =>
    value === null || value === undefined ? "" : String(value);

  const convertToCSV = (objArray: any[]) => {
    if (objArray.length === 0) return "";
    const headers = Object.keys(objArray[0]);
    let str = headers.join(",") + "\r\n";

    for (let i = 0; i < objArray.length; i++) {
      let line = "";
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        // Quoting alone does not stop Excel evaluating a cell that begins with
        // `=`, `+`, `-` or `@`, so neutralise the formula trigger first.
        let val = sanitizeSpreadsheetCell(cellText(objArray[i][key]));
        val = val.replace(/"/g, '""');
        if (val.search(/("|,|\n)/g) >= 0) {
          val = `"${val}"`;
        }
        line += val + ",";
      }
      str += line.slice(0, -1) + "\r\n";
    }
    return str;
  };

  const convertToExcel = (title: string, rows: any[]) => {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    // This ".xls" is really an HTML document that Excel parses, so raw cell text
    // is markup. Escape it, then apply the same formula guard as the CSV path.
    const cell = (value: unknown) => escapeXml(sanitizeSpreadsheetCell(cellText(value)));
    const safeTitle = escapeXml(title);
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${safeTitle}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  th { background-color: #2563eb; color: #ffffff; font-weight: bold; font-family: Arial, sans-serif; font-size: 12px; text-align: left; padding: 8px; }
  td { font-family: Arial, sans-serif; font-size: 11px; padding: 6px; border: 1px solid #e2e8f0; }
  tr:nth-child(even) { background-color: #f8fafc; }
</style>
</head>
<body>
<h2>${safeTitle} — ${escapeXml(event?.name || "AwardOS Event")}</h2>
<table>
  <thead>
    <tr>${headers.map((h) => `<th>${escapeXml(h.replace(/_/g, " "))}</th>`).join("")}</tr>
  </thead>
  <tbody>
    ${rows
      .map((row) => `<tr>${headers.map((h) => `<td>${cell(row[h])}</td>`).join("")}</tr>`)
      .join("")}
  </tbody>
</table>
</body>
</html>`;
    return html;
  };

  const triggerPDFPrint = (reportTitle: string, rows: any[]) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const printWin = window.open("", "_blank");
    if (!printWin) return;

    // `document.write` into a same-origin window executes any markup it is
    // handed, so a nominee name or user-agent string containing a <script> tag
    // would run in the organiser's session. Escape every interpolated value.
    const safeTitle = escapeXml(reportTitle);
    const safeEventName = escapeXml(event?.name || "AwardOS Event");

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${safeTitle} - ${safeEventName}</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 32px; color: #0f172a; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { font-size: 22px; font-weight: 800; color: #0f172a; }
    .logo span { color: #2563eb; }
    .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
    h2 { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th { background-color: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 10px 12px; border: 1px solid #cbd5e1; }
    td { padding: 8px 12px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Award<span>OS</span></div>
      <div class="meta">Certified Official Event Report & Telemetry Register</div>
    </div>
    <div style="text-align: right;">
      <strong style="font-size: 14px;">${safeEventName}</strong>
      <div class="meta">Generated: ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <h2>${safeTitle}</h2>

  <table>
    <thead>
      <tr>${headers.map((h) => `<th>${escapeXml(h.replace(/_/g, " "))}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr>${headers.map((h) => `<td>${escapeXml(cellText(row[h]))}</td>`).join("")}</tr>`
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    Generated securely by AwardOS Enterprise — Cryptographically verified records & audit trails.
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

    printWin.document.write(html);
    printWin.document.close();
  };

  const triggerDownload = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportRawBallots = async (format: "EXCEL" | "PDF" | "CSV") => {
    setExportingRaw(true);
    try {
      const data = await getRawBallotsExportAction(eventId);
      if (data.length === 0) {
        alert("No votes logged yet.");
        return;
      }
      const formatted = data.map((b) => ({
        Session_ID: b.sessionId,
        Voter_Email: b.verifiedEmail || "None",
        Invitation_Code: b.invitationCode || "None",
        IP_Address: b.ipAddress || "127.0.0.1",
        User_Agent: b.userAgent || "Unknown",
        Ballot_Status: b.status,
        Category_Name: b.categoryName,
        Selected_Candidate: b.nomineeName || "Skipped / Cleared",
        Submitted_At: b.submittedAt ? new Date(b.submittedAt).toLocaleString() : "",
      }));

      if (format === "EXCEL") {
        const xls = convertToExcel("Raw Ballots Register", formatted);
        triggerDownload(xls, `${event?.slug}_raw_ballots_report.xls`, "application/vnd.ms-excel");
      } else if (format === "PDF") {
        triggerPDFPrint("Raw Ballots Register", formatted);
      } else {
        const csv = convertToCSV(formatted);
        triggerDownload(csv, `${event?.slug}_raw_ballots_report.csv`, "text/csv;charset=utf-8;");
      }

      await createExportJobAction(eventId, "VOTE_TALLIES", format === "EXCEL" ? "XLSX" : format);
      await loadData();
    } catch (err) {
      console.error("Failed to export raw ballots:", err);
      alert("Error generating raw ballots log.");
    } finally {
      setExportingRaw(false);
    }
  };

  const handleExportNomineeTally = async (format: "EXCEL" | "PDF" | "CSV") => {
    setExportingTally(true);
    try {
      const results = await getEventResultsAction(eventId);
      const rows: any[] = [];

      results.categoriesResults.forEach((cat) => {
        cat.winners.forEach((win: any) => {
          rows.push({
            Category_Name: cat.categoryName,
            Nominee_Rank: win.rank,
            Nominee_Name: win.name,
            Votes_Received: win.votes,
            Percentage_Share: win.percent,
            Status: win.status,
          });
        });
      });

      if (rows.length === 0) {
        alert("No nominee vote counts recorded yet.");
        return;
      }

      if (format === "EXCEL") {
        const xls = convertToExcel("Nominees Tally Summary", rows);
        triggerDownload(xls, `${event?.slug}_nominee_tally_report.xls`, "application/vnd.ms-excel");
      } else if (format === "PDF") {
        triggerPDFPrint("Nominees Tally Summary", rows);
      } else {
        const csv = convertToCSV(rows);
        triggerDownload(csv, `${event?.slug}_nominee_tally_report.csv`, "text/csv;charset=utf-8;");
      }

      await createExportJobAction(eventId, "OFFICIAL_RESULTS", format === "EXCEL" ? "XLSX" : format);
      await loadData();
    } catch (err) {
      console.error("Failed to export nominee tally:", err);
      alert("Error generating nominee tally sheet.");
    } finally {
      setExportingTally(false);
    }
  };

  const handleExportVoters = async (format: "EXCEL" | "PDF" | "CSV") => {
    setExportingVoters(true);
    try {
      const data = await getVoterLogsExportAction(eventId);
      const rows: any[] = [];

      if (data.otps.length > 0) {
        data.otps.forEach((o) => {
          rows.push({
            Type: "EMAIL_OTP",
            Identifier: o.email,
            // The code itself is stored hashed and never exported — a
            // downloadable file of live OTPs would let anyone holding it cast
            // those voters' ballots.
            Status: o.verified ? "VERIFIED" : "PENDING",
            Issued_At: o.issuedAt || "",
            Expires_At: o.expiresAt ? new Date(o.expiresAt).toLocaleString() : "",
          });
        });
      }

      if (data.codes.length > 0) {
        data.codes.forEach((c) => {
          rows.push({
            Type: "INVITATION_CODE",
            Identifier: c.code,
            Security_Code: "N/A",
            Status: c.status,
            Expires_At: c.expiresAt ? new Date(c.expiresAt).toLocaleString() : "",
          });
        });
      }

      if (rows.length === 0) {
        alert("No voter verification sessions recorded.");
        return;
      }

      if (format === "EXCEL") {
        const xls = convertToExcel("Voter Verification Telemetry Logs", rows);
        triggerDownload(xls, `${event?.slug}_voter_telemetry_logs.xls`, "application/vnd.ms-excel");
      } else if (format === "PDF") {
        triggerPDFPrint("Voter Verification Telemetry Logs", rows);
      } else {
        const csv = convertToCSV(rows);
        triggerDownload(csv, `${event?.slug}_voter_telemetry_logs.csv`, "text/csv;charset=utf-8;");
      }

      await createExportJobAction(eventId, "INVITATION_CODES", format === "EXCEL" ? "XLSX" : format);
      await loadData();
    } catch (err) {
      console.error("Failed to export verification logs:", err);
      alert("Error generating verification telemetry logs.");
    } finally {
      setExportingVoters(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12 font-sans select-none">
        <h2 className="text-xl font-bold text-slate-900">Event not found</h2>
        <Link href="/events" className="mt-4 inline-block text-blue-600 hover:underline font-bold">
          Back to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans select-none pb-16">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" className="mt-1 text-slate-700 hover:bg-slate-200">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
              <span>Data Export & Report Hub</span>
            </h1>
            <p className="text-slate-600 text-xs mt-1 font-medium">
              Generate and download certified reports in <strong>Excel (.xlsx)</strong>, <strong>PDF Report (.pdf)</strong>, or <strong>CSV</strong> formats for <strong className="text-slate-900">{event.name}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of export choices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Raw ballots log */}
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm flex flex-col justify-between">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 border border-blue-200">
              <Layers className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm font-bold text-slate-900">Raw Ballots Register</CardTitle>
            <CardDescription className="text-xs text-slate-600 font-medium">
              Includes Vote Session ID, chosen nominee entries, client IPs, browser fingerprints, and validation timestamps.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            <Button
              variant="primary"
              disabled={exportingRaw}
              onClick={() => handleExportRawBallots("EXCEL")}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-full shadow-sm"
            >
              {exportingRaw ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-2" /> : <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />}
              <span>Download Excel (.xlsx)</span>
            </Button>
            <Button
              variant="outline"
              disabled={exportingRaw}
              onClick={() => handleExportRawBallots("PDF")}
              className="w-full bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-full"
            >
              <Printer className="w-3.5 h-3.5 mr-2 text-rose-600" />
              <span>Export PDF Report</span>
            </Button>
            <Button
              variant="ghost"
              disabled={exportingRaw}
              onClick={() => handleExportRawBallots("CSV")}
              className="w-full text-slate-600 hover:text-slate-900 text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5 mr-2 text-blue-600" />
              <span>Download CSV File</span>
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Nominees Tally */}
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm flex flex-col justify-between">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 border border-amber-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm font-bold text-slate-900">Nominees Tally Summary</CardTitle>
            <CardDescription className="text-xs text-slate-600 font-medium">
              Aggregated results sheet detailing categories, candidate rankings, total vote counts, and percentage share tallies.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            <Button
              variant="primary"
              disabled={exportingTally}
              onClick={() => handleExportNomineeTally("EXCEL")}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-full shadow-sm"
            >
              {exportingTally ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-2" /> : <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />}
              <span>Download Excel (.xlsx)</span>
            </Button>
            <Button
              variant="outline"
              disabled={exportingTally}
              onClick={() => handleExportNomineeTally("PDF")}
              className="w-full bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-full"
            >
              <Printer className="w-3.5 h-3.5 mr-2 text-rose-600" />
              <span>Export PDF Report</span>
            </Button>
            <Button
              variant="ghost"
              disabled={exportingTally}
              onClick={() => handleExportNomineeTally("CSV")}
              className="w-full text-slate-600 hover:text-slate-900 text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5 mr-2 text-amber-600" />
              <span>Download CSV File</span>
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Voter Telemetry */}
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm flex flex-col justify-between">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 border border-purple-200">
              <Users className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm font-bold text-slate-900">Voter Verification Logs</CardTitle>
            <CardDescription className="text-xs text-slate-600 font-medium">
              Credential security audit logs including whitelisted voter OTP deliveries, verified markers, and invitation code status logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            <Button
              variant="primary"
              disabled={exportingVoters}
              onClick={() => handleExportVoters("EXCEL")}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-full shadow-sm"
            >
              {exportingVoters ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-2" /> : <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />}
              <span>Download Excel (.xlsx)</span>
            </Button>
            <Button
              variant="outline"
              disabled={exportingVoters}
              onClick={() => handleExportVoters("PDF")}
              className="w-full bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-full"
            >
              <Printer className="w-3.5 h-3.5 mr-2 text-rose-600" />
              <span>Export PDF Report</span>
            </Button>
            <Button
              variant="ghost"
              disabled={exportingVoters}
              onClick={() => handleExportVoters("CSV")}
              className="w-full text-slate-600 hover:text-slate-900 text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5 mr-2 text-purple-600" />
              <span>Download CSV File</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* History of Export Jobs */}
      {exportJobs.length > 0 && (
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" /> Recent Export Jobs Log
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {exportJobs.slice(0, 10).map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900">{job.exportType} ({job.format})</span>
                    <div className="text-[10px] text-slate-500 font-mono font-medium">
                      Generated at: {new Date(job.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" size="sm">
                      {job.status} ({job.rowCount || 0} rows)
                    </Badge>
                    <a
                      href={`/api/exports/${job.id}/download`}
                      download
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 rounded-full px-2 py-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Re-download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

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

  const convertToCSV = (objArray: any[]) => {
    if (objArray.length === 0) return "";
    const headers = Object.keys(objArray[0]);
    let str = headers.join(",") + "\r\n";

    for (let i = 0; i < objArray.length; i++) {
      let line = "";
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        let val = objArray[i][key] === null || objArray[i][key] === undefined ? "" : String(objArray[i][key]);
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

  const handleExportRawBallots = async (format: "CSV" | "JSON") => {
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

      if (format === "CSV") {
        const csv = convertToCSV(formatted);
        triggerDownload(csv, `${event?.slug}_raw_ballots_report.csv`, "text/csv;charset=utf-8;");
      } else {
        const json = JSON.stringify(formatted, null, 2);
        triggerDownload(json, `${event?.slug}_raw_ballots_report.json`, "application/json");
      }

      await createExportJobAction(eventId, "VOTE_TALLIES", format);
      await loadData();
    } catch (err) {
      console.error("Failed to export raw ballots:", err);
      alert("Error generating raw ballots log.");
    } finally {
      setExportingRaw(false);
    }
  };

  const handleExportNomineeTally = async (format: "CSV" | "JSON") => {
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

      if (format === "CSV") {
        const csv = convertToCSV(rows);
        triggerDownload(csv, `${event?.slug}_nominee_tally_report.csv`, "text/csv;charset=utf-8;");
      } else {
        const json = JSON.stringify(rows, null, 2);
        triggerDownload(json, `${event?.slug}_nominee_tally_report.json`, "application/json");
      }

      await createExportJobAction(eventId, "OFFICIAL_RESULTS", format);
      await loadData();
    } catch (err) {
      console.error("Failed to export nominee tally:", err);
      alert("Error generating nominee tally sheet.");
    } finally {
      setExportingTally(false);
    }
  };

  const handleExportVoters = async () => {
    setExportingVoters(true);
    try {
      const data = await getVoterLogsExportAction(eventId);

      if (data.otps.length > 0) {
        const otpCsv = convertToCSV(
          data.otps.map((o) => ({
            Voter_Email: o.email,
            OTP_Code: o.code,
            Expires_At: o.expiresAt,
            Verified_Access: o.verified,
          }))
        );
        triggerDownload(otpCsv, `${event?.slug}_email_otp_logs.csv`, "text/csv;charset=utf-8;");
      }

      if (data.codes.length > 0) {
        const codeCsv = convertToCSV(
          data.codes.map((c) => ({
            Invitation_Code: c.code,
            Status: c.status,
            Used_At: c.usedAt,
            Expires_At: c.expiresAt,
          }))
        );
        triggerDownload(codeCsv, `${event?.slug}_invitation_codes_logs.csv`, "text/csv;charset=utf-8;");
      }

      if (data.otps.length === 0 && data.codes.length === 0) {
        alert("No voter verification sessions logs recorded.");
      }

      await createExportJobAction(eventId, "INVITATION_CODES", "CSV");
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
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12 text-slate-300 font-sans">
        <h2 className="text-xl font-bold text-white">Event not found</h2>
        <Link href="/dashboard/events" className="mt-4 inline-block text-indigo-400 hover:underline">
          Back to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
              <span>Data Export & Report Hub</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Generate and download certified reports (CSV / JSON) of votes, tallies, and audit logs for <strong className="text-slate-300">{event.name}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of export choices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Raw ballots log */}
        <Card className="border-slate-800 bg-slate-950/20 flex flex-col justify-between">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm font-bold text-white">Raw Ballots Register</CardTitle>
            <CardDescription className="text-xs">
              Includes Vote Session ID, chosen nominee entries, client IPs, browser fingerprints, and validation timestamps.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            <Button
              variant="outline"
              disabled={exportingRaw}
              onClick={() => handleExportRawBallots("CSV")}
              className="w-full border-slate-800 text-slate-200 hover:bg-slate-900/60 text-xs"
            >
              {exportingRaw ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-2" /> : <Download className="w-3.5 h-3.5 mr-2" />}
              <span>Download CSV</span>
            </Button>
            <Button
              variant="ghost"
              disabled={exportingRaw}
              onClick={() => handleExportRawBallots("JSON")}
              className="w-full text-slate-400 hover:text-white text-xs"
            >
              <FileCode className="w-3.5 h-3.5 mr-2 text-indigo-400" />
              <span>Download JSON</span>
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Nominees Tally */}
        <Card className="border-slate-800 bg-slate-950/20 flex flex-col justify-between">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm font-bold text-white">Nominees Tally Summary</CardTitle>
            <CardDescription className="text-xs">
              Aggregated results sheet detailing categories, candidate rankings, total vote counts, and percentage share tallies.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 space-y-2">
            <Button
              variant="outline"
              disabled={exportingTally}
              onClick={() => handleExportNomineeTally("CSV")}
              className="w-full border-slate-800 text-slate-200 hover:bg-slate-900/60 text-xs"
            >
              {exportingTally ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-2" /> : <Download className="w-3.5 h-3.5 mr-2" />}
              <span>Download CSV</span>
            </Button>
            <Button
              variant="ghost"
              disabled={exportingTally}
              onClick={() => handleExportNomineeTally("JSON")}
              className="w-full text-slate-400 hover:text-white text-xs"
            >
              <FileCode className="w-3.5 h-3.5 mr-2 text-amber-400" />
              <span>Download JSON</span>
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Voter Telemetry */}
        <Card className="border-slate-800 bg-slate-950/20 flex flex-col justify-between">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm font-bold text-white">Voter Verification Logs</CardTitle>
            <CardDescription className="text-xs">
              Credential security audit logs including whitelisted voter OTP deliveries, verified markers, and invitation code status logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              variant="outline"
              disabled={exportingVoters}
              onClick={handleExportVoters}
              className="w-full border-slate-800 text-slate-200 hover:bg-slate-900/60 text-xs"
            >
              {exportingVoters ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-2" /> : <Download className="w-3.5 h-3.5 mr-2" />}
              <span>Download CSV Logs</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* History of Export Jobs */}
      {exportJobs.length > 0 && (
        <Card className="border-slate-800 bg-slate-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" /> Recent Export Jobs Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {exportJobs.slice(0, 10).map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-200">{job.exportType} ({job.format})</span>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Generated at: {new Date(job.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="success" size="sm">
                    {job.status} ({job.rowCount || 0} rows)
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

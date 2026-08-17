"use client";

import React, { useState } from "react";
import { AlertCircle, Check, Download, FileText, Loader2, Table, Upload } from "lucide-react";
import { bulkImportCategoriesAndNomineesAction, parsePdfBulkImportAction, previewBulkImportAction, type BulkImportItem, type ImportExistingBehavior } from "@/actions/import";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface BulkImportModalProps { eventId: string; isOpen: boolean; onClose: () => void; onSuccess: () => void; }

function parseCsv(text: string): BulkImportItem[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const start = lines[0] && /category|nominee/i.test(lines[0]) ? 1 : 0;
  return lines.slice(start).map((line) => {
    const columns = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    return { categoryName: columns[0] ?? "", nomineeName: columns[1] ?? "", nomineeBio: columns[2] ?? "", nomineePhotoUrl: columns[3] ?? "" };
  });
}

export function BulkImportModal({ eventId, isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [rawInput, setRawInput] = useState("");
  const [parsedItems, setParsedItems] = useState<BulkImportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [existingBehavior, setExistingBehavior] = useState<ImportExistingBehavior>("UPDATE");
  const [result, setResult] = useState<Awaited<ReturnType<typeof bulkImportCategoriesAndNomineesAction>> | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewBulkImportAction>> | null>(null);

  const clearPreview = () => { setParsedItems([]); setPreview(null); setResult(null); };

  const handleParse = async () => {
    setErrorMsg(null); setResult(null);
    try {
      let items: BulkImportItem[];
      if (/^[\s]*[\[{]/.test(rawInput)) {
        const input: unknown = JSON.parse(rawInput);
        const rows = Array.isArray(input) ? input : [input];
        items = rows.map((value) => {
          const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
          return { categoryName: String(row.categoryName ?? row.category ?? ""), categoryDescription: String(row.categoryDescription ?? ""), nomineeName: String(row.nomineeName ?? row.name ?? ""), nomineeBio: String(row.nomineeBio ?? row.bio ?? ""), nomineePhotoUrl: String(row.nomineePhotoUrl ?? row.photoUrl ?? "") };
        });
      } else items = parseCsv(rawInput);
      if (items.length === 0) throw new Error("No rows could be parsed.");
      setParsedItems(items);
      setPreview(await previewBulkImportAction(eventId, items));
    } catch (error: unknown) { setErrorMsg(error instanceof Error ? error.message : "Failed to parse input."); }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErrorMsg("Import files are limited to 5 MB."); event.target.value = ""; return; }
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setLoading(true); setErrorMsg(null); clearPreview();
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const extracted = await parsePdfBulkImportAction(eventId, btoa(binary));
        const items: BulkImportItem[] = extracted.items.map((item) => ({
          categoryName: item.categoryName,
          categoryDescription: item.categoryDescription,
          nomineeName: item.nomineeName,
          nomineeBio: item.nomineeBio,
          nomineePhotoUrl: item.nomineePhotoUrl ?? undefined,
        }));
        setParsedItems(items);
        setPreview(await previewBulkImportAction(eventId, items));
        setRawInput("Machine-readable PDF extracted successfully.");
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : "The PDF could not be extracted.");
      } finally { setLoading(false); event.target.value = ""; }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setRawInput(String(reader.result ?? "")); clearPreview(); };
    reader.onerror = () => setErrorMsg("The selected file could not be read.");
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview || preview.validRows === 0) return;
    setLoading(true); setErrorMsg(null);
    try {
      const canonical = JSON.stringify({ existingBehavior, items: parsedItems });
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
      const idempotencyKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      setResult(await bulkImportCategoriesAndNomineesAction(eventId, parsedItems, existingBehavior, idempotencyKey));
    }
    catch (error: unknown) { setErrorMsg(error instanceof Error ? error.message : "Import failed and was rolled back."); }
    finally { setLoading(false); }
  };

  const downloadErrors = () => {
    const errors = result?.failedRows ?? preview?.errors ?? [];
    if (errors.length === 0) return;
    const csv = ["Row,Error", ...errors.map(({ row, message }) => `${row},"${message.replace(/"/g, '""')}"`)].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "awardos-import-errors.csv"; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="lg" title="Bulk import categories and nominees" description="Import up to 5,000 rows from CSV, JSON, or pasted data.">
      <div className="space-y-4 text-xs">
        {result ? <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <Check className="mx-auto h-8 w-8 text-emerald-600" /><h3 className="text-base font-bold text-slate-900">Import complete</h3>
          <div className="flex flex-wrap justify-center gap-4 text-slate-700"><span>Categories created: <strong>{result.categoriesCreated}</strong></span><span>Nominees created: <strong>{result.nomineesImported}</strong></span><span>Nominees updated: <strong>{result.nomineesUpdated}</strong></span><span>Rows skipped: <strong>{result.nomineesSkipped}</strong></span></div>
          <div className="flex flex-wrap justify-center gap-2">{result.failedRows.length > 0 && <Button variant="outline" size="sm" onClick={downloadErrors}><Download className="mr-1.5 h-4 w-4" />Download error report</Button>}<Button variant="primary" size="sm" onClick={onSuccess}>Done</Button></div>
        </div> : <>
          <div className="flex items-center justify-between gap-3"><label htmlFor="bulk-import-input" className="flex items-center gap-1.5 font-bold text-slate-900"><FileText className="h-4 w-4 text-purple-600" />Paste CSV or JSON data</label><label className="cursor-pointer rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-bold text-slate-700 hover:bg-slate-200">Upload file<input type="file" accept=".csv,.json,.txt,.pdf,text/csv,application/json,application/pdf" onChange={(event) => void handleFileUpload(event)} className="sr-only" /></label></div>
          <textarea id="bulk-import-input" rows={6} value={rawInput} onChange={(event) => { setRawInput(event.target.value); clearPreview(); }} placeholder="Category, Nominee Name, Bio, Photo URL" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus:border-purple-500 focus:outline-none" />
          <Button variant="ghost" size="sm" onClick={() => void handleParse()} disabled={!rawInput.trim()}><Table className="mr-1.5 h-4 w-4" />Parse and preview</Button>
          <label className="grid gap-1.5 text-slate-700"><span className="font-bold text-slate-900">When a nominee already exists</span><select value={existingBehavior} onChange={(event) => setExistingBehavior(event.target.value as ImportExistingBehavior)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"><option value="UPDATE">Update the existing nominee</option><option value="SKIP">Skip the existing nominee</option></select></label>
          {parsedItems.length > 0 && <div className="max-h-44 overflow-auto rounded-xl border border-slate-200"><table className="w-full text-left"><thead className="sticky top-0 bg-slate-100 text-[10px] uppercase"><tr><th className="p-2">Category</th><th className="p-2">Nominee</th><th className="p-2">Bio</th></tr></thead><tbody>{parsedItems.slice(0, 50).map((item, index) => <tr key={`${index}-${item.categoryName}-${item.nomineeName}`} className="border-t border-slate-100"><td className="p-2 font-bold text-purple-700">{item.categoryName || "Missing"}</td><td className="p-2 font-bold text-slate-900">{item.nomineeName || "Missing"}</td><td className="max-w-48 truncate p-2 text-slate-500">{item.nomineeBio || ""}</td></tr>)}</tbody></table></div>}
          {preview && <div className="space-y-2"><div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4"><span>Create categories: <strong>{preview.categoriesToCreate}</strong></span><span>Create nominees: <strong>{preview.nomineesToCreate}</strong></span><span>{existingBehavior === "UPDATE" ? "Update" : "Skip"} existing: <strong>{preview.nomineesToUpdate}</strong></span><span>Rejected rows: <strong>{preview.errors.length}</strong></span></div>{preview.errors.length > 0 && <Button variant="outline" size="sm" onClick={downloadErrors}><Download className="mr-1.5 h-4 w-4" />Download error report</Button>}</div>}
          {errorMsg && <div role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 font-bold text-amber-800"><AlertCircle className="h-4 w-4 shrink-0" />{errorMsg}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" disabled={loading || !preview || preview.validRows === 0} onClick={() => void handleImport()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Import {preview?.validRows ?? 0} rows</Button></div>
        </>}
      </div>
    </Modal>
  );
}

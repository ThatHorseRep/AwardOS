"use client";

import React, { useState } from "react";
import { Upload, FileText, Check, AlertCircle, Loader2, X, Download, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { bulkImportCategoriesAndNomineesAction, BulkImportItem } from "@/actions/import";

interface BulkImportModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportModal({ eventId, isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [rawInput, setRawInput] = useState("");
  const [parsedItems, setParsedItems] = useState<BulkImportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<any | null>(null);

  if (!isOpen) return null;

  const parseCSV = (csvText: string): BulkImportItem[] => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const results: BulkImportItem[] = [];
    const hasHeader = lines[0].toLowerCase().includes("category") || lines[0].toLowerCase().includes("nominee");
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((c) => c.replace(/^"|"$/g, "").trim());
      if (cols.length >= 2) {
        results.push({
          categoryName: cols[0],
          nomineeName: cols[1],
          nomineeBio: cols[2] || "",
          nomineePhotoUrl: cols[3] || "",
          nomineeEmail: cols[4] || "",
        });
      }
    }
    return results;
  };

  const handleParse = () => {
    setErrorMsg(null);
    setResultSummary(null);
    try {
      if (rawInput.trim().startsWith("[") || rawInput.trim().startsWith("{")) {
        const json = JSON.parse(rawInput);
        const list = Array.isArray(json) ? json : [json];
        setParsedItems(
          list.map((item: any) => ({
            categoryName: item.categoryName || item.category || "General",
            nomineeName: item.nomineeName || item.name || "",
            nomineeBio: item.nomineeBio || item.bio || "",
            nomineePhotoUrl: item.nomineePhotoUrl || item.photoUrl || "",
            nomineeEmail: item.nomineeEmail || item.email || "",
          }))
        );
      } else {
        const items = parseCSV(rawInput);
        if (items.length === 0) {
          throw new Error("Could not parse valid columns. Expected format: Category, Nominee Name, Bio, Photo URL");
        }
        setParsedItems(items);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse input");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setRawInput(text);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (parsedItems.length === 0) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await bulkImportCategoriesAndNomineesAction(eventId, parsedItems);
      setResultSummary(res);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error("Bulk Import Error:", err);
      setErrorMsg(err.message || "Failed to process bulk import");
    } finally {
      setLoading(false);
    }
  };

  const sampleCSV = `Category,Nominee Name,Nominee Bio,Photo URL
Student Leader of the Year,Ama Mensah,SRC Vice President & Tech Lead,https://images.unsplash.com/photo-1534528741775-53994a69daeb
Tech Innovator Award,Kwame Osei,Creator of Campus Ride App,https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <Card className="border-slate-200/80 bg-white max-w-2xl w-full font-sans shadow-2xl relative rounded-3xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 font-bold"
        >
          <X className="w-4 h-4" />
        </button>

        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-600" /> Bulk Import Categories & Nominees
          </CardTitle>
          <CardDescription className="text-slate-600 text-xs font-medium">
            Import hundreds of categories and nominees instantly via CSV format or JSON payload.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-xs pt-4">
          {resultSummary ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Import Completed Successfully!</h3>
              <div className="flex justify-center gap-4 text-slate-700 text-xs font-medium">
                <span>Created Categories: <strong className="text-emerald-700 font-bold">{resultSummary.categoriesCreated}</strong></span>
                <span>Imported Nominees: <strong className="text-emerald-700 font-bold">{resultSummary.nomineesImported}</strong></span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <label className="font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600" /> Paste CSV / JSON Data
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setRawInput(sampleCSV);
                      setParsedItems(parseCSV(sampleCSV));
                    }}
                    className="text-[10px] text-purple-600 font-bold hover:underline flex items-center gap-1"
                  >
                    Load Sample CSV
                  </button>
                  <label className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer border border-slate-200">
                    Upload .CSV File
                    <input type="file" accept=".csv,.json,.txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <textarea
                rows={5}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={`Format: Category, Nominee Name, Bio, Photo URL\ne.g. Student Leader, Ama Mensah, SRC Vice President, https://...`}
                className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl p-3.5 border border-slate-200 focus:outline-none focus:border-purple-500 font-mono font-medium"
              />

              <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" onClick={handleParse} className="text-purple-600 hover:text-purple-700 font-bold">
                  <Table className="w-3.5 h-3.5 mr-1" /> Parse & Preview ({parsedItems.length} items ready)
                </Button>
              </div>

              {/* Parsed Items Preview Table */}
              {parsedItems.length > 0 && (
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-slate-50">
                  <div className="p-2.5 bg-slate-100 font-bold text-[10px] text-slate-600 grid grid-cols-12 gap-2 uppercase tracking-wider">
                    <span className="col-span-4">Category</span>
                    <span className="col-span-4">Nominee Name</span>
                    <span className="col-span-4">Bio / Extra Info</span>
                  </div>
                  {parsedItems.slice(0, 20).map((item, idx) => (
                    <div key={idx} className="p-2.5 text-[11px] text-slate-700 grid grid-cols-12 gap-2 items-center font-medium">
                      <span className="col-span-4 font-bold text-purple-700 truncate">{item.categoryName}</span>
                      <span className="col-span-4 font-bold text-slate-900 truncate">{item.nomineeName}</span>
                      <span className="col-span-4 text-slate-500 truncate text-[10px]">{item.nomineeBio || "No bio"}</span>
                    </div>
                  ))}
                  {parsedItems.length > 20 && (
                    <div className="p-2 text-center text-[10px] text-slate-500 font-mono font-bold">
                      + {parsedItems.length - 20} more entries ready to import
                    </div>
                  )}
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-600 hover:text-slate-900 font-medium">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={loading || parsedItems.length === 0}
                  onClick={handleImportSubmit}
                  className="rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold px-5"
                >
                  {loading ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  <span>Import {parsedItems.length} Entries</span>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

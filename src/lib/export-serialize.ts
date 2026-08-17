import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sanitizeSpreadsheetRows } from "@/lib/sanitize";

export type ExportFormat = "CSV" | "XLSX" | "JSON" | "PDF";

function csvCell(value: unknown) {
  const text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function serializeCsv(rows: Array<Record<string, unknown>>) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  if (headers.length === 0) return "";
  return [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\r\n");
}

export async function serializeExportSnapshot(payload: Array<Record<string, unknown>>, format: ExportFormat, filename: string, sheetName: string, branding?: { eventName?: string; accentColor?: string | null }) {
  if (format === "JSON") {
    return { body: Buffer.from(JSON.stringify(payload, null, 2), "utf8"), contentType: "application/json; charset=utf-8", disposition: `attachment; filename="${filename}.json"` };
  }

  const sanitizedRows = sanitizeSpreadsheetRows(payload);
  if (format === "PDF") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const headers = Array.from(new Set(sanitizedRows.flatMap((row) => Object.keys(row))));
    const hex = branding?.accentColor?.match(/^#?([0-9a-f]{6})$/i)?.[1];
    const accent = hex ? rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255) : rgb(0.1, 0.3, 0.7);
    let page = pdf.addPage([842, 595]);
    let y = 560;
    const draw = (text: string, x: number, size = 8, isBold = false) => page.drawText(text.slice(0, 150), { x, y, size, font: isBold ? bold : font, color: rgb(0.08, 0.11, 0.18) });
    page.drawRectangle({ x: 0, y: 565, width: 842, height: 30, color: accent });
    page.drawText((branding?.eventName || sheetName).slice(0, 100), { x: 36, y: 575, size: 14, font: bold, color: rgb(1, 1, 1) });
    draw(sheetName.replaceAll("_", " "), 36, 16, true); y -= 28;
    draw(headers.join(" | "), 36, 8, true); y -= 14;
    for (const row of sanitizedRows) {
      if (y < 40) { page = pdf.addPage([842, 595]); y = 560; draw(headers.join(" | "), 36, 8, true); y -= 14; }
      draw(headers.map((header) => String(row[header] ?? "").replace(/[\r\n]+/g, " ")).join(" | "), 36);
      y -= 12;
    }
    return { body: Buffer.from(await pdf.save()), contentType: "application/pdf", disposition: `attachment; filename="${filename}.pdf"` };
  }
  if (format === "CSV") {
    return { body: Buffer.from(serializeCsv(sanitizedRows), "utf8"), contentType: "text/csv; charset=utf-8", disposition: `attachment; filename="${filename}.csv"` };
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));
  const headers = Array.from(new Set(sanitizedRows.flatMap((row) => Object.keys(row))));
  worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(50, Math.max(12, header.length + 2)) }));
  sanitizedRows.forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return { body: Buffer.from(buffer), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", disposition: `attachment; filename="${filename}.xlsx"` };
}

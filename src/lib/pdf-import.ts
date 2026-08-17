import { validateBulkImportItems, type BulkImportItem } from "@/lib/bulk-import";

const MAX_PDF_BYTES = 5 * 1024 * 1024;

function rowsFromText(text: string): BulkImportItem[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^category\s*[|,]\s*(nominee|name)/i.test(line))
    .map((line) => {
      const cells = line.split(/[|,\t]/).map((cell) => cell.trim());
      return {
        categoryName: cells[0] ?? "",
        nomineeName: cells[1] ?? "",
        nomineeBio: cells[2] ?? "",
        nomineePhotoUrl: cells[3] ?? "",
      };
    });
}

export async function extractMachineReadablePdfImport(base64: string) {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PDF_BYTES) {
    throw new Error("PDF imports are limited to 5 MB.");
  }
  if (bytes.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new Error("The uploaded file is not a valid PDF.");
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const lines: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    const pageLines = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const line = pageLines.get(y) ?? [];
      line.push({ x: item.transform[4], text: item.str.trim() });
      pageLines.set(y, line);
    }
    for (const [, line] of [...pageLines.entries()].sort(([a], [b]) => b - a)) {
      lines.push(line.sort((a, b) => a.x - b.x).map((item) => item.text).join(" | "));
    }
  }
  if (lines.length === 0) {
    throw new Error("This PDF has no extractable text. Upload a machine-readable PDF or configure OCR first.");
  }
  const items = rowsFromText(lines.join("\n"));
  const validation = validateBulkImportItems(items);
  if (validation.valid.length === 0) {
    throw new Error("No valid category and nominee rows were found in the PDF.");
  }
  return { items: validation.valid, errors: validation.errors, totalRows: validation.totalRows };
}

import { sanitizePlainText } from "@/lib/sanitize";

export interface BulkImportItem {
  categoryName: string;
  categoryDescription?: string;
  nomineeName?: string;
  nomineeBio?: string;
  nomineePhotoUrl?: string;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ValidatedImportItem {
  sourceRow: number;
  categoryName: string;
  categoryDescription: string;
  nomineeName: string;
  nomineeBio: string;
  nomineePhotoUrl: string | null;
  duplicateKey: string;
}

export function parseBulkImportText(text: string): BulkImportItem[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const firstColumns = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  const hasHeader = firstColumns.some((cell) => /^(category|category name|nominee|nominee name|name|bio|photo url)$/.test(cell));
  const headers = hasHeader ? firstColumns : [];

  return lines.slice(hasHeader ? 1 : 0).map((line) => {
    const columns = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    const value = (...names: string[]) => {
      const index = headers.findIndex((header) => names.includes(header));
      return index >= 0 ? columns[index] ?? "" : "";
    };
    if (hasHeader) return {
      categoryName: value("category", "category name"),
      nomineeName: value("nominee", "nominee name", "name"),
      nomineeBio: value("bio"),
      nomineePhotoUrl: value("photo url"),
    };
    return { categoryName: columns[0] ?? "", nomineeName: columns[1] ?? "", nomineeBio: columns[2] ?? "", nomineePhotoUrl: columns[3] ?? "" };
  });
}

export function validateBulkImportItems(items: BulkImportItem[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No import items provided.");
  }
  if (items.length > 5000) {
    throw new Error("Imports are limited to 5,000 rows per transaction.");
  }

  const valid: ValidatedImportItem[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();
  let duplicateRows = 0;

  items.forEach((item, index) => {
    const sourceRow = index + 1;
    const categoryName = sanitizePlainText(item?.categoryName, 255);
    const categoryDescription = sanitizePlainText(item?.categoryDescription ?? "", 1000);
    const nomineeName = sanitizePlainText(item?.nomineeName, 255);
    const nomineeBio = sanitizePlainText(item?.nomineeBio ?? "", 2000);
    const rawPhotoUrl = typeof item?.nomineePhotoUrl === "string" ? item.nomineePhotoUrl.trim() : "";

    if (!categoryName) {
      errors.push({ row: sourceRow, message: "Category name is required." });
      return;
    }

    const hasNomineeDetails = Boolean(nomineeName || nomineeBio || rawPhotoUrl);
    if (hasNomineeDetails && !nomineeName) {
      errors.push({ row: sourceRow, message: "Nominee name is required when nominee details are provided." });
      return;
    }

    let nomineePhotoUrl: string | null = null;
    if (rawPhotoUrl) {
      try {
        const parsed = new URL(rawPhotoUrl);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
        nomineePhotoUrl = parsed.toString().slice(0, 2048);
      } catch {
        errors.push({ row: sourceRow, message: "Photo URL must be an absolute HTTP or HTTPS URL." });
        return;
      }
    }

    const duplicateKey = nomineeName
      ? `${categoryName.toLocaleLowerCase()}:${nomineeName.toLocaleLowerCase().replace(/\s+/g, " ")}`
      : `category:${categoryName.toLocaleLowerCase()}`;
    if (seen.has(duplicateKey)) {
      duplicateRows += 1;
      errors.push({ row: sourceRow, message: nomineeName ? "Duplicate category and nominee in this import." : "Duplicate category in this import." });
      return;
    }
    seen.add(duplicateKey);
    valid.push({ sourceRow, categoryName, categoryDescription, nomineeName, nomineeBio, nomineePhotoUrl, duplicateKey });
  });

  return { valid, errors, duplicateRows, totalRows: items.length };
}

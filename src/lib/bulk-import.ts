import { sanitizePlainText } from "@/lib/sanitize";

export interface BulkImportItem {
  categoryName: string;
  categoryDescription?: string;
  nomineeName: string;
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

    if (!categoryName || !nomineeName) {
      errors.push({ row: sourceRow, message: "Category and nominee name are required." });
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

    const duplicateKey = `${categoryName.toLocaleLowerCase()}:${nomineeName.toLocaleLowerCase().replace(/\s+/g, " ")}`;
    if (seen.has(duplicateKey)) {
      duplicateRows += 1;
      errors.push({ row: sourceRow, message: "Duplicate category and nominee in this import." });
      return;
    }
    seen.add(duplicateKey);
    valid.push({ sourceRow, categoryName, categoryDescription, nomineeName, nomineeBio, nomineePhotoUrl, duplicateKey });
  });

  return { valid, errors, duplicateRows, totalRows: items.length };
}

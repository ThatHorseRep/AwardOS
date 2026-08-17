import { describe, expect, it } from "vitest";
import { validateBulkImportItems } from "@/lib/bulk-import";

describe("bulk import validation", () => {
  it("sanitizes fields and accepts valid HTTP photo URLs", () => {
    const result = validateBulkImportItems([{ categoryName: "<b>Leadership</b>", nomineeName: "  Ama   Mensah ", nomineeBio: "<script>alert(1)</script>Leader", nomineePhotoUrl: "https://example.com/ama.jpg" }]);
    expect(result.errors).toEqual([]);
    expect(result.valid[0]).toMatchObject({ categoryName: "Leadership", nomineeName: "Ama Mensah", nomineeBio: "Leader", nomineePhotoUrl: "https://example.com/ama.jpg" });
  });

  it("rejects duplicate rows case-insensitively and keeps only the first", () => {
    const result = validateBulkImportItems([
      { categoryName: "Innovation", nomineeName: "Ada Lovelace" },
      { categoryName: "innovation", nomineeName: "ADA   LOVELACE" },
    ]);
    expect(result.valid).toHaveLength(1);
    expect(result.duplicateRows).toBe(1);
    expect(result.errors).toEqual([{ row: 2, message: "Duplicate category and nominee in this import." }]);
  });

  it("reports invalid rows without discarding valid rows", () => {
    const result = validateBulkImportItems([
      { categoryName: "", nomineeName: "Missing category" },
      { categoryName: "Service", nomineeName: "Valid Person" },
      { categoryName: "Service", nomineeName: "Bad URL", nomineePhotoUrl: "javascript:alert(1)" },
    ]);
    expect(result.totalRows).toBe(3);
    expect(result.valid).toHaveLength(1);
    expect(result.errors.map((error) => error.row)).toEqual([1, 3]);
  });

  it("enforces the transaction row limit", () => {
    const rows = Array.from({ length: 5001 }, (_, index) => ({ categoryName: "Category", nomineeName: `Nominee ${index}` }));
    expect(() => validateBulkImportItems(rows)).toThrow("5,000 rows");
  });
});

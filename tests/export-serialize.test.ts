import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { serializeExportSnapshot } from "@/lib/export-serialize";

const payload = [{ Category: "Leadership", Nominee: "=HYPERLINK(\"https://bad.example\")", Votes: 7 }];

describe("export snapshot serialization", () => {
  it("produces real JSON without altering machine-readable values", async () => {
    const result = await serializeExportSnapshot(payload, "JSON", "event_results", "Results");
    expect(result.contentType).toBe("application/json; charset=utf-8");
    expect(result.disposition).toContain("event_results.json");
    expect(JSON.parse(result.body.toString())).toEqual(payload);
  });

  it("produces CSV and neutralizes formulas", async () => {
    const result = await serializeExportSnapshot(payload, "CSV", "event_results", "Results");
    expect(result.contentType).toBe("text/csv; charset=utf-8");
    expect(result.body.toString()).toContain("'=HYPERLINK");
  });

  it("produces a readable XLSX workbook with literal formula text", async () => {
    const result = await serializeExportSnapshot(payload, "XLSX", "event_results", "Official Results");
    expect(result.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.body as never);
    const worksheet = workbook.worksheets[0];
    expect(worksheet.getRow(2).values).toEqual([, "Leadership", "'=HYPERLINK(\"https://bad.example\")", 7]);
  });

  it("produces a genuine PDF report", async () => {
    const result = await serializeExportSnapshot(payload, "PDF", "event_results", "Official Results");
    expect(result.contentType).toBe("application/pdf");
    expect(result.disposition).toContain("event_results.pdf");
    expect(result.body.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

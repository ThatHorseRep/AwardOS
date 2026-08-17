import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractMachineReadablePdfImport } from "@/lib/pdf-import";

async function buildTextPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 400]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("Category | Nominee | Bio", { x: 40, y: 340, size: 12, font });
  page.drawText("Leadership | Ada Okafor | Student council chair", { x: 40, y: 310, size: 12, font });
  return Buffer.from(await pdf.save()).toString("base64");
}

describe("machine-readable PDF imports", () => {
  it("extracts category and nominee rows", async () => {
    const result = await extractMachineReadablePdfImport(await buildTextPdf());
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ categoryName: "Leadership", nomineeName: "Ada Okafor" });
  });

  it("rejects a non-PDF payload", async () => {
    await expect(extractMachineReadablePdfImport(Buffer.from("not a pdf").toString("base64"))).rejects.toThrow("not a valid PDF");
  });
});

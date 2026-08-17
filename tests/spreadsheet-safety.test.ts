import { describe, expect, it } from "vitest";
import { sanitizeSpreadsheetCell, sanitizeSpreadsheetRows } from "@/lib/sanitize";

describe("spreadsheet export safety", () => {
  it.each(["=SUM(1,1)", "+cmd", "-2+3", "@IMPORTXML()", "  =HYPERLINK()", "\t=cmd"])('neutralizes formula-like cell %j', (value) => {
    expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`);
  });

  it("preserves ordinary text and non-string values", () => {
    expect(sanitizeSpreadsheetRows([{ Name: "Ama Mensah", Votes: 12, Empty: null }])).toEqual([{ Name: "Ama Mensah", Votes: 12, Empty: null }]);
  });
});

import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/navigation-intent";

describe("safe internal navigation intent", () => {
  it("preserves an internal protected route with query parameters", () => {
    expect(safeInternalPath("/events/abc/results?tab=official")).toBe("/events/abc/results?tab=official");
  });

  it("rejects absolute, protocol-relative, backslash, and auth-loop destinations", () => {
    expect(safeInternalPath("https://evil.example/path")).toBe("/dashboard");
    expect(safeInternalPath("//evil.example/path")).toBe("/dashboard");
    expect(safeInternalPath("/\\evil.example/path")).toBe("/dashboard");
    expect(safeInternalPath("/sign-in?redirect=/events")).toBe("/dashboard");
  });
});

import { describe, expect, it } from "vitest";
import { safeRedirectTarget } from "./redirect";

describe("safeRedirectTarget", () => {
  it("accepts a plain relative path", () => {
    expect(safeRedirectTarget("/matches/abc-123")).toBe("/matches/abc-123");
  });

  it("defaults to / when nothing is given", () => {
    expect(safeRedirectTarget(null)).toBe("/");
    expect(safeRedirectTarget(undefined)).toBe("/");
    expect(safeRedirectTarget("")).toBe("/");
  });

  it("rejects an absolute URL to another host (open-redirect attempt)", () => {
    expect(safeRedirectTarget("https://evil.example/phish")).toBe("/");
    expect(safeRedirectTarget("http://evil.example")).toBe("/");
  });

  it("rejects a protocol-relative URL (//host also escapes the current site)", () => {
    expect(safeRedirectTarget("//evil.example")).toBe("/");
  });

  it("rejects a path with no leading slash", () => {
    expect(safeRedirectTarget("matches/abc-123")).toBe("/");
  });
});

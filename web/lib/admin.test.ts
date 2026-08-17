import { describe, expect, it } from "vitest";
import { resolveSchoolContext } from "./admin";
import type { StaffProfile } from "./staff";

function staff(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: "staff-1",
    email: "staff@example.com",
    role: "school_operator",
    schoolId: "school-1",
    ...overrides,
  };
}

describe("resolveSchoolContext", () => {
  it("a school_operator always acts on their own school, ignoring any query param", () => {
    const s = staff({ role: "school_operator", schoolId: "school-1" });
    expect(resolveSchoolContext(s, undefined)).toBe("school-1");
    // Even if someone tampered with the URL to claim a different school,
    // the operator's own profile wins — this is the one thing worth a
    // dedicated test, since it's the closest this file gets to an
    // authorization decision.
    expect(resolveSchoolContext(s, "someone-elses-school")).toBe("school-1");
  });

  it("a school_operator with no school on their profile resolves to null", () => {
    const s = staff({ role: "school_operator", schoolId: null });
    expect(resolveSchoolContext(s, "school-1")).toBe(null);
  });

  it("a platform_admin has no school of their own — resolves from the query param", () => {
    const s = staff({ role: "platform_admin", schoolId: null });
    expect(resolveSchoolContext(s, "school-2")).toBe("school-2");
  });

  it("a platform_admin with no query param resolves to null (show the picker)", () => {
    const s = staff({ role: "platform_admin", schoolId: null });
    expect(resolveSchoolContext(s, undefined)).toBe(null);
    expect(resolveSchoolContext(s, "")).toBe(null);
  });
});

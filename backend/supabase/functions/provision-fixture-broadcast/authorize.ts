// Pulled out of index.ts so the authorization decision is unit-testable
// without a live Supabase project. See index.ts for how this gets used.

export interface CallerProfile {
  role: "platform_admin" | "school_operator" | "parent";
  schoolId: string | null;
}

/**
 * Reads the `role` claim out of a JWT's payload without verifying its
 * signature. That's safe here specifically because Supabase's edge
 * runtime already verified the signature before our handler ever runs
 * (the `verify_jwt` setting, on by default) — this is reading an
 * already-authenticated fact, not re-authenticating from scratch.
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * Who may trigger provisioning for a given fixture:
 * - the on_fixture_created database trigger, calling with the project's
 *   service-role key (jwtRole "service_role"). Trusted unconditionally —
 *   it only ever fires as a direct consequence of a fixture INSERT that
 *   RLS already restricted to a platform admin or that school's own
 *   operator, so re-checking here would just be re-litigating a decision
 *   RLS already made.
 * - a platform admin, calling with their own session (e.g. to
 *   re-provision after an error).
 * - the school_operator belonging to the fixture's host school.
 */
export function isAuthorizedToProvision(params: {
  jwtRole: string | null;
  profile: CallerProfile | null;
  fixtureHostSchoolId: string;
}): boolean {
  if (params.jwtRole === "service_role") return true;
  if (!params.profile) return false;
  if (params.profile.role === "platform_admin") return true;
  return (
    params.profile.role === "school_operator" &&
    params.profile.schoolId === params.fixtureHostSchoolId
  );
}

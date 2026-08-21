// Pulled out of index.ts so the authorization decision is unit-testable
// without a live Supabase project. See index.ts for how this gets used.

export interface CallerProfile {
  role: "platform_admin" | "school_operator" | "parent";
}

/**
 * Unlike provision-fixture-broadcast, there's no service-role-trusted
 * caller here (nothing but a human admin ever calls this function) and no
 * "own school" carve-out either — inviting a school's first operator is
 * platform_admin only, same as creating the school itself
 * (createSchoolAction) or approving its signup request
 * (approveSchoolRequestAction). A school_operator inviting a colleague at
 * their own school might be worth adding later, but isn't today.
 */
export function isAuthorizedToInvite(profile: CallerProfile | null): boolean {
  return profile?.role === "platform_admin";
}

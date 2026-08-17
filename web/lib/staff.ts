import { cache } from "react";
import { createSupabaseServerClient, isBackendConfigured } from "./supabase-server";

export type StaffRole = "platform_admin" | "school_operator";

export interface StaffProfile {
  id: string;
  email: string | null;
  role: StaffRole;
  schoolId: string | null;
}

/**
 * Unlike lib/auth.ts's getCurrentParent (which only checks "is there a
 * session" — every public sign-up is a parent, full stop), admin/operator
 * accounts are never self-serve (see backend/README.md — elevating a
 * profile to school_operator or platform_admin is a deliberate admin
 * action), so this actually reads the profiles table to find out who's
 * signed in and whether they're staff at all. A parent hitting an /admin
 * page gets null here, same as being signed out.
 *
 * Cached per-request (React's cache()) since both app/admin/layout.tsx and
 * whichever admin page is rendering need this, and it shouldn't mean two
 * round trips.
 */
export const getCurrentStaffProfile = cache(async (): Promise<StaffProfile | null> => {
  if (!isBackendConfigured) return null;
  const supabase = createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile) return null;
  if (profile.role !== "platform_admin" && profile.role !== "school_operator") return null;

  return {
    id: userData.user.id,
    email: userData.user.email ?? null,
    role: profile.role,
    schoolId: profile.school_id,
  };
});

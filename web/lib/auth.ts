import { cache } from "react";
import { createSupabaseServerClient, isBackendConfigured } from "./supabase-server";

export interface CurrentParent {
  id: string;
  email: string | null;
}

/**
 * Named for what a session on this app means today, not because there's a
 * distinct "parent" role check here — every account created through this
 * public site's sign-up is a parent (backend/supabase/migrations'
 * handle_new_user trigger defaults every new sign-up to role='parent'; the
 * only way to become a school_operator or platform_admin is a deliberate
 * admin action, not this form). Nothing here reads the profiles table at
 * all — it's purely "is there a valid session," which is exactly what the
 * spec's 4.4 login gate needs. Contrast with lib/staff.ts's
 * getCurrentStaffProfile(), which does read profiles, because the admin
 * panel needs to know role and school.
 *
 * Wrapped in React's cache() so a request that reads this from both
 * app/layout.tsx and a page (e.g. a match page checking the viewing gate)
 * only does the actual auth lookup once.
 */
export const getCurrentParent = cache(async (): Promise<CurrentParent | null> => {
  if (!isBackendConfigured) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});

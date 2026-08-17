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
 * spec's 4.4 login gate needs.
 */
export async function getCurrentParent(): Promise<CurrentParent | null> {
  if (!isBackendConfigured) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

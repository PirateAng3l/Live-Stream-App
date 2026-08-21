import { createSupabaseServerClient } from "./supabase-server";

export type SchoolRequestStatus = "pending" | "approved" | "rejected";

export interface SchoolSignupRequest {
  id: string;
  schoolName: string;
  contactName: string | null;
  contactEmail: string;
  contactPhone: string | null;
  notes: string | null;
  status: SchoolRequestStatus;
  createdAt: string;
}

export async function loadSchoolRequests(): Promise<SchoolSignupRequest[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("school_signup_requests")
    .select("id, school_name, contact_name, contact_email, contact_phone, notes, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load school requests: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    schoolName: row.school_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/**
 * A cheap head-only count for the admin nav badge — platform_admin only
 * (see admin/layout.tsx), so this doesn't run at all for a school_operator.
 */
export async function loadPendingSchoolRequestCount(): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("school_signup_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(`Could not load pending school request count: ${error.message}`);
  return count ?? 0;
}

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
  resultingSchoolId: string | null;
  createdAt: string;
  /**
   * False for an approved request whose school has no school_operator
   * profile yet — approveSchoolRequestAction invites one automatically now,
   * but a request approved before that existed, or one where the invite
   * itself failed, can still be sitting in exactly that state. Always false
   * for a request that isn't approved (resultingSchoolId is null). Checked
   * here rather than only surfaced as a one-off toast from the approve
   * action, so it stays visible on reload, not just in the instant right
   * after clicking Approve.
   */
  hasOperator: boolean;
}

export async function loadSchoolRequests(): Promise<SchoolSignupRequest[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("school_signup_requests")
    .select(
      "id, school_name, contact_name, contact_email, contact_phone, notes, status, resulting_school_id, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load school requests: ${error.message}`);

  const resultingSchoolIds = (data ?? [])
    .map((row) => row.resulting_school_id)
    .filter((id): id is string => id !== null);

  let schoolIdsWithOperator = new Set<string>();
  if (resultingSchoolIds.length > 0) {
    const { data: operators, error: operatorsError } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("role", "school_operator")
      .in("school_id", resultingSchoolIds);
    if (operatorsError) throw new Error(`Could not load school operators: ${operatorsError.message}`);
    schoolIdsWithOperator = new Set((operators ?? []).map((row) => row.school_id as string));
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    schoolName: row.school_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    notes: row.notes,
    status: row.status,
    resultingSchoolId: row.resulting_school_id,
    createdAt: row.created_at,
    hasOperator: row.resulting_school_id ? schoolIdsWithOperator.has(row.resulting_school_id) : false,
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

"use server";

import { revalidatePath } from "next/cache";
import { inviteSchoolOperator } from "@/lib/invite-operator";
import { getCurrentStaffProfile, type StaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ActionState {
  error?: string;
  /**
   * Set only when approval itself succeeded (the school and the request's
   * own status are already committed) but the automatic invite that
   * follows it didn't go out — distinct from `error`, which school-
   * request-row.tsx renders as if nothing happened at all. The "Invite
   * operator" link next to every approved request (school-requests/
   * page.tsx) is the recovery path: re-running it is exactly
   * inviteSchoolOperator again, by hand.
   */
  warning?: string;
}

type AdminCheck = { ok: true; staff: StaffProfile } | { ok: false; error: string };

async function requirePlatformAdmin(): Promise<AdminCheck> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { ok: false, error: "Not signed in as staff" };
  if (staff.role !== "platform_admin") {
    return { ok: false, error: "Only a platform admin can review school requests" };
  }
  return { ok: true, staff };
}

/**
 * Creates the real `schools` row the same way /admin/school/new's
 * createSchoolAction does, then marks the request approved and links it to
 * that new school — school_signup_requests_admin_manage (migration 0007)
 * is the real backstop on both writes, this just short-circuits with a
 * friendlier error for anyone who isn't platform_admin. Finally, invites
 * the request's own contact_email as that school's operator, via the same
 * inviteSchoolOperator helper the manual "Invite operator" form uses.
 *
 * That invite used to be a second, separate action a platform_admin had to
 * remember to trigger by hand after approving — in practice it kept getting
 * missed (approve felt like the finished action), leaving a school
 * approved with no way to actually sign in and nothing on screen saying
 * so. Folding it into approval itself is the fix: one click, and the
 * school's contact is the one invited, not whatever the admin happens to
 * type into a form afterward.
 */
export async function approveSchoolRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const check = await requirePlatformAdmin();
  if (!check.ok) return { error: check.error };

  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Missing request" };

  const supabase = createSupabaseServerClient();
  const { data: request, error: loadError } = await supabase
    .from("school_signup_requests")
    .select("id, school_name, contact_email, contact_phone, status")
    .eq("id", requestId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!request) return { error: "Request not found" };
  if (request.status !== "pending") return { error: "This request has already been reviewed" };

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .insert({
      name: request.school_name,
      contact_email: request.contact_email,
      contact_phone: request.contact_phone,
    })
    .select("id")
    .single();
  if (schoolError) return { error: schoolError.message };

  const { error: updateError } = await supabase
    .from("school_signup_requests")
    .update({
      status: "approved",
      resulting_school_id: school.id,
      reviewed_by: check.staff.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updateError) return { error: updateError.message };

  // The school is fully approved regardless of what happens below — an
  // invite failure here is never worth undoing that, and there's nothing to
  // undo it with anyway (no transaction spans these three writes). The
  // "Invite operator" link on every approved request is the retry path.
  const inviteResult = await inviteSchoolOperator(supabase, {
    email: request.contact_email,
    schoolId: school.id,
  });
  if (inviteResult.error) {
    revalidatePath("/admin/school-requests");
    return {
      warning: `${request.school_name} was approved, but the invite email to ${request.contact_email} didn't go out (${inviteResult.error}). Use "Invite operator" below to retry.`,
    };
  }

  revalidatePath("/admin/school-requests");
  return {};
}

export async function rejectSchoolRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const check = await requirePlatformAdmin();
  if (!check.ok) return { error: check.error };

  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) return { error: "Missing request" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("school_signup_requests")
    .update({
      status: "rejected",
      reviewed_by: check.staff.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/admin/school-requests");
  return {};
}

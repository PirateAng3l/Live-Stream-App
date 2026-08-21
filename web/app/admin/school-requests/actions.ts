"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile, type StaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ActionState {
  error?: string;
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
 * friendlier error for anyone who isn't platform_admin.
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

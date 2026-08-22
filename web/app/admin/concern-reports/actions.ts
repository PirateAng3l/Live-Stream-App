"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ConcernReportStatus } from "@/lib/concern-reports";

export interface ActionState {
  error?: string;
}

/**
 * concern_reports_admin_manage (migration 0013) is the real backstop —
 * this is the same friendlier-error-first pattern as every other admin
 * action here. Reviewing a report doesn't itself take anything down; that's
 * VisibilityToggleForm on the fixture's own detail page (a report might
 * reference a fixture, but resolving "this report was a false alarm"
 * shouldn't be conflated with "take the video down").
 */
export async function setConcernReportStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };
  if (staff.role !== "platform_admin") return { error: "Only a platform admin can review concern reports" };

  const reportId = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "") as ConcernReportStatus;
  if (!reportId) return { error: "Missing report" };
  if (!["reviewed", "resolved"].includes(status)) return { error: "Invalid status" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("concern_reports")
    .update({ status, reviewed_by: staff.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) return { error: error.message };

  revalidatePath("/admin/concern-reports");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ActionState {
  error?: string;
}

export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  // schoolId is re-derived from the staff profile server-side, never
  // trusted from the form — a school_operator submitting a tampered
  // hidden field still only ever creates a team for their own school. RLS
  // (teams_write_own_school) would reject a mismatch anyway, but there's
  // no reason to rely on that as the only line of defense.
  const schoolId = resolveSchoolContext(staff, String(formData.get("school_id") ?? ""));
  if (!schoolId) return { error: "A school is required" };

  const name = String(formData.get("name") ?? "").trim();
  const sport = String(formData.get("sport") ?? "");
  if (!name) return { error: "Team name is required" };
  if (!sport) return { error: "Sport is required" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("teams").insert({ name, sport, school_id: schoolId });
  if (error) return { error: error.message };

  revalidatePath("/admin/teams");
  redirect(schoolId && staff.role === "platform_admin" ? `/admin/teams?school=${schoolId}` : "/admin/teams");
}

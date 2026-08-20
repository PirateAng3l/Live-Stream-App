"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadTeamById, resolveSchoolContext, type TeamDetail } from "@/lib/admin";
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

type OwnTeamCheck = { ok: true; team: TeamDetail } | { ok: false; error: string };

/**
 * Re-derives the team's own school from the database rather than trusting
 * the form, same pattern as the fixture-detail actions — a school_operator
 * submitting a tampered hidden field still only ever touches their own
 * school's team. RLS (teams_write_own_school) is the real backstop.
 */
async function requireOwnTeam(teamId: string, staff: { role: string; schoolId: string | null }): Promise<OwnTeamCheck> {
  const team = await loadTeamById(teamId);
  if (!team) return { ok: false, error: "Team not found" };
  if (staff.role === "school_operator" && staff.schoolId !== team.schoolId) {
    return { ok: false, error: "This team belongs to a different school" };
  }
  return { ok: true, team };
}

export async function updateTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const teamId = String(formData.get("team_id") ?? "");
  if (!teamId) return { error: "Missing team" };

  let check: OwnTeamCheck;
  try {
    check = await requireOwnTeam(teamId, staff);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!check.ok) return { error: check.error };

  const name = String(formData.get("name") ?? "").trim();
  const sport = String(formData.get("sport") ?? "");
  if (!name) return { error: "Team name is required" };
  if (!sport) return { error: "Sport is required" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("teams").update({ name, sport }).eq("id", teamId);
  if (error) return { error: error.message };

  revalidatePath("/admin/teams");
  redirect(staff.role === "platform_admin" ? `/admin/teams?school=${check.team.schoolId}` : "/admin/teams");
}

export async function deleteTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const teamId = String(formData.get("team_id") ?? "");
  if (!teamId) return { error: "Missing team" };

  let check: OwnTeamCheck;
  try {
    check = await requireOwnTeam(teamId, staff);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!check.ok) return { error: check.error };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) {
    // 23503 = Postgres foreign-key-violation — teams have no ON DELETE
    // behavior on fixtures.home_team_id/away_team_id (deliberately: a
    // fixture referencing a since-deleted team would be a data-integrity
    // mess), so this is the expected, catchable way a school finds out a
    // team is still in use rather than a raw SQL error.
    if (error.code === "23503") {
      return { error: "This team is used by an existing fixture — remove or reassign that fixture first." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/teams");
  redirect(staff.role === "platform_admin" ? `/admin/teams?school=${check.team.schoolId}` : "/admin/teams");
}

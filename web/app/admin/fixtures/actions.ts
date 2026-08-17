"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ActionState {
  error?: string;
}

export async function createFixtureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  // Same reasoning as createTeamAction: schoolId always comes from the
  // staff profile for a school_operator, never trusted from the form.
  const schoolId = resolveSchoolContext(staff, String(formData.get("school_id") ?? ""));
  if (!schoolId) return { error: "A school is required" };

  const sport = String(formData.get("sport") ?? "");
  const homeTeamId = String(formData.get("home_team_id") ?? "");
  const awayTeamId = String(formData.get("away_team_id") ?? "");
  const scheduledStartLocal = String(formData.get("scheduled_start") ?? "");

  if (!sport) return { error: "Sport is required" };
  if (!homeTeamId || !awayTeamId) return { error: "Home and away teams are required" };
  if (homeTeamId === awayTeamId) return { error: "Home and away teams must be different" };
  if (!scheduledStartLocal) return { error: "Kickoff time is required" };

  const scheduledStart = new Date(scheduledStartLocal);
  if (Number.isNaN(scheduledStart.getTime())) return { error: "Kickoff time is invalid" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("fixtures").insert({
    sport,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    host_school_id: schoolId,
    scheduled_start: scheduledStart.toISOString(),
  });
  // Provisioning the YouTube broadcast happens automatically from here —
  // this insert is exactly what backend's on_fixture_created_provision_broadcast
  // trigger (migration 0002) fires on. Nothing else to call.
  if (error) return { error: error.message };

  revalidatePath("/admin");
  redirect("/admin");
}

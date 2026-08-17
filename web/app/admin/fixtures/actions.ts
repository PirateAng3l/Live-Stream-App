"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSubscriptionOperational, subscriptionStatusLabel } from "@/lib/subscriptions";
import { loadSubscriptionForSchool } from "@/lib/subscriptions-server";

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

  // Migration 0005's RLS is the real backstop (fixtures_insert_own_school
  // rejects the insert outright for an expired/cancelled subscription) —
  // this is the same friendly-error-before-hitting-RLS pattern used
  // everywhere else here, so a lapsed school gets a clear reason instead of
  // a raw policy-violation message. Fails open on a missing subscription
  // row, same as the RLS check itself (see lib/subscriptions-server.ts).
  const subscription = await loadSubscriptionForSchool(schoolId).catch(() => null);
  if (subscription && !isSubscriptionOperational(subscription.status)) {
    return {
      error: `This school's subscription is ${subscriptionStatusLabel(subscription.status).toLowerCase()} — new fixtures can't be created until it's renewed.`,
    };
  }

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

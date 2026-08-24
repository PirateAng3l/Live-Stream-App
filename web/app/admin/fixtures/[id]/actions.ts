"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SPONSOR_LAYERS, SPONSOR_POSITIONS, SPONSOR_TIERS } from "@/lib/sponsors";
import { getCurrentStaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ActionState {
  error?: string;
}

/**
 * Both actions re-derive the fixture's host school from the fixtures table
 * itself rather than trusting anything the form submits — the fixture's
 * school is fixed at creation time, there's no picker on this page the way
 * there is on the create-a-fixture/team/sponsor forms. A school_operator
 * whose own school doesn't match gets a clear error here; RLS (migration
 * 0004's fixture_sponsors_write_own_school, which also checks the
 * sponsor's own school) is the real backstop either way.
 */
async function loadFixtureHostSchool(fixtureId: string): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select("host_school_id")
    .eq("id", fixtureId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.host_school_id ?? null;
}

export async function assignSponsorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const fixtureId = String(formData.get("fixture_id") ?? "");
  if (!fixtureId) return { error: "Missing fixture" };

  let hostSchoolId: string | null;
  try {
    hostSchoolId = await loadFixtureHostSchool(fixtureId);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!hostSchoolId) return { error: "Fixture not found" };
  if (staff.role === "school_operator" && staff.schoolId !== hostSchoolId) {
    return { error: "This fixture belongs to a different school" };
  }

  const sponsorId = String(formData.get("sponsor_id") ?? "");
  const tier = String(formData.get("tier") ?? "");
  const position = String(formData.get("position") ?? "");
  const layer = String(formData.get("layer") ?? "");

  if (!sponsorId) return { error: "A sponsor is required" };
  if (!SPONSOR_TIERS.includes(tier as (typeof SPONSOR_TIERS)[number])) return { error: "Tier is required" };
  if (!SPONSOR_POSITIONS.includes(position as (typeof SPONSOR_POSITIONS)[number])) {
    return { error: "Position is required" };
  }
  if (!SPONSOR_LAYERS.includes(layer as (typeof SPONSOR_LAYERS)[number])) return { error: "Layer is required" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("fixture_sponsors").insert({
    fixture_id: fixtureId,
    sponsor_id: sponsorId,
    tier,
    position,
    layer,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/fixtures/${fixtureId}`);
  return {};
}

export async function removeSponsorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const fixtureId = String(formData.get("fixture_id") ?? "");
  const sponsorId = String(formData.get("sponsor_id") ?? "");
  const layer = String(formData.get("layer") ?? "");
  if (!fixtureId || !sponsorId || !layer) return { error: "Missing sponsor assignment" };

  let hostSchoolId: string | null;
  try {
    hostSchoolId = await loadFixtureHostSchool(fixtureId);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!hostSchoolId) return { error: "Fixture not found" };
  if (staff.role === "school_operator" && staff.schoolId !== hostSchoolId) {
    return { error: "This fixture belongs to a different school" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("fixture_sponsors")
    .delete()
    .eq("fixture_id", fixtureId)
    .eq("sponsor_id", sponsorId)
    .eq("layer", layer);
  if (error) return { error: error.message };

  revalidatePath(`/admin/fixtures/${fixtureId}`);
  return {};
}

/**
 * Same host-school re-derivation as the sponsor actions above — the form
 * can't be trusted to say which fixture it's editing belongs to which
 * school. RLS (fixtures_update_own_school / fixtures_write_admin, migration
 * 0005) is the real backstop either way.
 */
export async function updateFixtureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const fixtureId = String(formData.get("fixture_id") ?? "");
  if (!fixtureId) return { error: "Missing fixture" };

  let hostSchoolId: string | null;
  try {
    hostSchoolId = await loadFixtureHostSchool(fixtureId);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!hostSchoolId) return { error: "Fixture not found" };
  if (staff.role === "school_operator" && staff.schoolId !== hostSchoolId) {
    return { error: "This fixture belongs to a different school" };
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
  const { error } = await supabase
    .from("fixtures")
    .update({
      sport,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      scheduled_start: scheduledStart.toISOString(),
    })
    .eq("id", fixtureId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/fixtures/${fixtureId}`);
  revalidatePath("/admin");
  redirect(`/admin/fixtures/${fixtureId}`);
}

/**
 * Spec 4.5's takedown lever (migration 0012) — flips hidden_from_viewers,
 * which /matches/[id] checks ahead of everything else before rendering
 * the video. Toggles rather than a one-way "hide" so a mistaken or
 * resolved takedown can be reversed without reaching into the database
 * directly. Same host-school re-derivation as every other action here;
 * fixtures_update_own_school/fixtures_write_admin (migrations 0001/0005)
 * are the real backstop.
 */
export async function toggleFixtureVisibilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const fixtureId = String(formData.get("fixture_id") ?? "");
  if (!fixtureId) return { error: "Missing fixture" };

  let hostSchoolId: string | null;
  try {
    hostSchoolId = await loadFixtureHostSchool(fixtureId);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!hostSchoolId) return { error: "Fixture not found" };
  if (staff.role === "school_operator" && staff.schoolId !== hostSchoolId) {
    return { error: "This fixture belongs to a different school" };
  }

  const hide = formData.get("hide") === "true";

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("fixtures").update({ hidden_from_viewers: hide }).eq("id", fixtureId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/fixtures/${fixtureId}`);
  revalidatePath(`/matches/${fixtureId}`);
  return {};
}

/**
 * Nothing else in this app ever set status='completed' or wrote a final
 * score — Android only ever queries status=eq.scheduled, it never writes a
 * status back, and there was no admin control for this either. A fixture
 * could stream, end, and just sit under "Upcoming" forever with no score,
 * which is exactly what showed up in testing. This is the fix: a manual
 * concierge action, same pattern as every other state change in this admin
 * panel, rather than trying to guess from the stream itself that a match
 * has actually finished (a dropped connection isn't the same as a final
 * whistle).
 *
 * Score fields are optional — a Clean Slate/Event fixture (sport "other")
 * has no scoreboard and no outcome to record, so the form for those just
 * submits blank score fields and this only flips status.
 */
export async function completeFixtureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const fixtureId = String(formData.get("fixture_id") ?? "");
  if (!fixtureId) return { error: "Missing fixture" };

  let hostSchoolId: string | null;
  try {
    hostSchoolId = await loadFixtureHostSchool(fixtureId);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!hostSchoolId) return { error: "Fixture not found" };
  if (staff.role === "school_operator" && staff.schoolId !== hostSchoolId) {
    return { error: "This fixture belongs to a different school" };
  }

  const homeScoreRaw = String(formData.get("final_home_score") ?? "").trim();
  const awayScoreRaw = String(formData.get("final_away_score") ?? "").trim();

  let homeScore: number | null = null;
  let awayScore: number | null = null;
  if (homeScoreRaw !== "") {
    homeScore = Number(homeScoreRaw);
    if (!Number.isInteger(homeScore) || homeScore < 0) return { error: "Home score must be a whole number" };
  }
  if (awayScoreRaw !== "") {
    awayScore = Number(awayScoreRaw);
    if (!Number.isInteger(awayScore) || awayScore < 0) return { error: "Away score must be a whole number" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("fixtures")
    .update({ status: "completed", final_home_score: homeScore, final_away_score: awayScore })
    .eq("id", fixtureId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/fixtures/${fixtureId}`);
  revalidatePath("/admin");
  revalidatePath(`/matches/${fixtureId}`);
  revalidatePath("/schedule");
  return {};
}

export async function deleteFixtureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const fixtureId = String(formData.get("fixture_id") ?? "");
  if (!fixtureId) return { error: "Missing fixture" };

  let hostSchoolId: string | null;
  try {
    hostSchoolId = await loadFixtureHostSchool(fixtureId);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!hostSchoolId) return { error: "Fixture not found" };
  if (staff.role === "school_operator" && staff.schoolId !== hostSchoolId) {
    return { error: "This fixture belongs to a different school" };
  }

  const supabase = createSupabaseServerClient();
  // fixture_sponsors and fixture_broadcast_credentials both cascade on
  // delete (migration 0001) — no need to clean those up separately. The
  // YouTube broadcast itself isn't deleted via the API; it's simply left
  // orphaned/unlisted on the channel, same as ending any other stream.
  const { error } = await supabase.from("fixtures").delete().eq("id", fixtureId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  redirect("/admin");
}

"use server";

import { revalidatePath } from "next/cache";
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

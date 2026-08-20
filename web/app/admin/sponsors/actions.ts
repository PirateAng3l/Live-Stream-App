"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSchoolContext } from "@/lib/admin";
import { loadSponsorById, type SponsorDetail } from "@/lib/sponsors-server";
import { SPONSOR_POSITIONS, SPONSOR_TIERS } from "@/lib/sponsors";
import { getCurrentStaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ActionState {
  error?: string;
}

export async function createSponsorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  // Same reasoning as createTeamAction/createFixtureAction: schoolId always
  // comes from the staff profile for a school_operator, never trusted from
  // the form — RLS (sponsors_own_school) would reject a mismatch anyway,
  // but this is the same defense-in-depth pattern used everywhere else here.
  const schoolId = resolveSchoolContext(staff, String(formData.get("school_id") ?? ""));
  if (!schoolId) return { error: "A school is required" };

  const name = String(formData.get("name") ?? "").trim();
  const tier = String(formData.get("tier") ?? "");
  const defaultPosition = String(formData.get("default_position") ?? "");
  const clickUrl = String(formData.get("click_url") ?? "").trim();
  const logoUrl = String(formData.get("logo_url") ?? "").trim();

  if (!name) return { error: "Sponsor name is required" };
  if (!SPONSOR_TIERS.includes(tier as (typeof SPONSOR_TIERS)[number])) return { error: "Tier is required" };
  if (!SPONSOR_POSITIONS.includes(defaultPosition as (typeof SPONSOR_POSITIONS)[number])) {
    return { error: "Default position is required" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("sponsors").insert({
    name,
    tier,
    default_position: defaultPosition,
    click_url: clickUrl || null,
    logo_url: logoUrl || null,
    school_id: schoolId,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/sponsors");
  redirect(schoolId && staff.role === "platform_admin" ? `/admin/sponsors?school=${schoolId}` : "/admin/sponsors");
}

type OwnSponsorCheck = { ok: true; sponsor: SponsorDetail } | { ok: false; error: string };

/**
 * Same re-derive-from-the-database pattern as requireOwnTeam (admin/teams/
 * actions.ts) — a school_operator submitting a tampered hidden field still
 * only ever touches their own school's sponsor. RLS (sponsors_own_school)
 * is the real backstop.
 */
async function requireOwnSponsor(
  sponsorId: string,
  staff: { role: string; schoolId: string | null },
): Promise<OwnSponsorCheck> {
  const sponsor = await loadSponsorById(sponsorId);
  if (!sponsor) return { ok: false, error: "Sponsor not found" };
  if (staff.role === "school_operator" && staff.schoolId !== sponsor.schoolId) {
    return { ok: false, error: "This sponsor belongs to a different school" };
  }
  return { ok: true, sponsor };
}

export async function updateSponsorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const sponsorId = String(formData.get("sponsor_id") ?? "");
  if (!sponsorId) return { error: "Missing sponsor" };

  let check: OwnSponsorCheck;
  try {
    check = await requireOwnSponsor(sponsorId, staff);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!check.ok) return { error: check.error };

  const name = String(formData.get("name") ?? "").trim();
  const tier = String(formData.get("tier") ?? "");
  const defaultPosition = String(formData.get("default_position") ?? "");
  const clickUrl = String(formData.get("click_url") ?? "").trim();
  const logoUrl = String(formData.get("logo_url") ?? "").trim();

  if (!name) return { error: "Sponsor name is required" };
  if (!SPONSOR_TIERS.includes(tier as (typeof SPONSOR_TIERS)[number])) return { error: "Tier is required" };
  if (!SPONSOR_POSITIONS.includes(defaultPosition as (typeof SPONSOR_POSITIONS)[number])) {
    return { error: "Default position is required" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("sponsors")
    .update({
      name,
      tier,
      default_position: defaultPosition,
      click_url: clickUrl || null,
      logo_url: logoUrl || null,
    })
    .eq("id", sponsorId);
  if (error) return { error: error.message };

  revalidatePath("/admin/sponsors");
  redirect(staff.role === "platform_admin" ? `/admin/sponsors?school=${check.sponsor.schoolId}` : "/admin/sponsors");
}

export async function deleteSponsorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const sponsorId = String(formData.get("sponsor_id") ?? "");
  if (!sponsorId) return { error: "Missing sponsor" };

  let check: OwnSponsorCheck;
  try {
    check = await requireOwnSponsor(sponsorId, staff);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!check.ok) return { error: check.error };

  const supabase = createSupabaseServerClient();
  // fixture_sponsors cascades on sponsor delete (migration 0001) — any
  // fixture this sponsor was assigned to just loses that assignment,
  // nothing blocks the delete the way an in-use team does.
  const { error } = await supabase.from("sponsors").delete().eq("id", sponsorId);
  if (error) return { error: error.message };

  revalidatePath("/admin/sponsors");
  redirect(staff.role === "platform_admin" ? `/admin/sponsors?school=${check.sponsor.schoolId}` : "/admin/sponsors");
}

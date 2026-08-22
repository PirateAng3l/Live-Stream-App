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

  if (!name) return { error: "Sponsor name is required" };
  if (!SPONSOR_TIERS.includes(tier as (typeof SPONSOR_TIERS)[number])) return { error: "Tier is required" };
  if (!SPONSOR_POSITIONS.includes(defaultPosition as (typeof SPONSOR_POSITIONS)[number])) {
    return { error: "Default position is required" };
  }

  // logo_url isn't set here — same reasoning as createSchoolAction leaving
  // logo upload to a separate step: a sponsor needs to exist (an id to
  // upload against, see updateSponsorLogoAction) before there's anywhere
  // for a file to go.
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sponsors")
    .insert({
      name,
      tier,
      default_position: defaultPosition,
      click_url: clickUrl || null,
      school_id: schoolId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/admin/sponsors");
  // Straight into the new sponsor's edit page — the natural next step is
  // uploading its logo, same as createSchoolAction's redirect.
  redirect(`/admin/sponsors/${data.id}/edit`);
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

  if (!name) return { error: "Sponsor name is required" };
  if (!SPONSOR_TIERS.includes(tier as (typeof SPONSOR_TIERS)[number])) return { error: "Tier is required" };
  if (!SPONSOR_POSITIONS.includes(defaultPosition as (typeof SPONSOR_POSITIONS)[number])) {
    return { error: "Default position is required" };
  }

  // logo_url deliberately isn't touched here — it's updateSponsorLogoForm's
  // own action (updateSponsorLogoAction) that owns it, same split as
  // updateSchoolLogoAction being separate from anything that edits a
  // school's other fields. Folding it in here would mean saving an
  // unrelated field (say, the click-through URL) on this form silently
  // wipes out an already-uploaded logo, since this form no longer carries
  // a logo_url value to preserve.
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("sponsors")
    .update({
      name,
      tier,
      default_position: defaultPosition,
      click_url: clickUrl || null,
    })
    .eq("id", sponsorId);
  if (error) return { error: error.message };

  revalidatePath("/admin/sponsors");
  redirect(staff.role === "platform_admin" ? `/admin/sponsors?school=${check.sponsor.schoolId}` : "/admin/sponsors");
}

const SPONSOR_LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const SPONSOR_LOGO_MAX_BYTES = 5 * 1024 * 1024;

const SPONSOR_LOGO_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Mirrors updateSchoolLogoAction almost exactly — same Storage-RLS-is-the-
 * real-backstop reasoning (sponsor_logos_insert_own/update_own, migration
 * 0009, check the object path's school_id segment against
 * current_school_id()/is_platform_admin()), same fixed-path-per-entity
 * upsert (`<school_id>/<sponsor_id>.<ext>`) so re-uploading replaces
 * rather than accumulates, same cache-busting query param so a changed
 * logo shows immediately everywhere it's used (this admin preview, the
 * match page's sponsor-overlay.tsx, and — once a fixture using this
 * sponsor is next loaded — the Android app).
 */
export async function updateSponsorLogoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
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

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload" };
  if (!SPONSOR_LOGO_ALLOWED_TYPES.includes(file.type)) return { error: "Logo must be a PNG, JPEG, or WebP image" };
  if (file.size > SPONSOR_LOGO_MAX_BYTES) return { error: "Logo must be smaller than 5MB" };

  const extension = SPONSOR_LOGO_EXTENSION_BY_TYPE[file.type];
  const path = `${check.sponsor.schoolId}/${sponsorId}.${extension}`;

  const supabase = createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from("sponsor-logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: publicUrlData } = supabase.storage.from("sponsor-logos").getPublicUrl(path);
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase.from("sponsors").update({ logo_url: logoUrl }).eq("id", sponsorId);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/admin/sponsors/${sponsorId}/edit`);
  revalidatePath("/admin/sponsors");
  return {};
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

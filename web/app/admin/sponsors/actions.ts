"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSchoolContext } from "@/lib/admin";
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

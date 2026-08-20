import type { FixtureSponsorAssignment, SponsorOption } from "./sponsors";
import { createSupabaseServerClient } from "./supabase-server";

export async function loadSponsorsForSchool(schoolId: string): Promise<SponsorOption[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sponsors")
    .select("id, name, tier, default_position, click_url, logo_url")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw new Error(`Could not load sponsors: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    tier: row.tier,
    defaultPosition: row.default_position,
    clickUrl: row.click_url,
    logoUrl: row.logo_url,
  }));
}

export interface SponsorDetail extends SponsorOption {
  schoolId: string;
}

export async function loadSponsorById(id: string): Promise<SponsorDetail | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sponsors")
    .select("id, name, tier, default_position, click_url, logo_url, school_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load sponsor ${id}: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    tier: data.tier,
    defaultPosition: data.default_position,
    clickUrl: data.click_url,
    logoUrl: data.logo_url,
    schoolId: data.school_id,
  };
}

/**
 * Two flat queries (fixture_sponsors, then sponsors by id) rather than an
 * embedded-relation select — same reasoning as resolveNames in supabase.ts:
 * a shared `.select()` literal breaks supabase-js's type inference, and this
 * avoids depending on the FK constraint name either way.
 */
export async function loadFixtureSponsors(fixtureId: string): Promise<FixtureSponsorAssignment[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("fixture_sponsors")
    .select("sponsor_id, position, tier, layer")
    .eq("fixture_id", fixtureId);
  if (error) throw new Error(`Could not load fixture sponsors: ${error.message}`);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const sponsorIds = Array.from(new Set(rows.map((row) => row.sponsor_id)));
  const { data: sponsors, error: sponsorsError } = await supabase
    .from("sponsors")
    .select("id, name, logo_url, click_url")
    .in("id", sponsorIds);
  if (sponsorsError) throw new Error(`Could not load sponsor details: ${sponsorsError.message}`);

  const sponsorById = new Map((sponsors ?? []).map((sponsor) => [sponsor.id, sponsor]));

  return rows.map((row) => {
    const sponsor = sponsorById.get(row.sponsor_id);
    return {
      sponsorId: row.sponsor_id,
      sponsorName: sponsor?.name ?? "Unknown sponsor",
      logoUrl: sponsor?.logo_url ?? null,
      clickUrl: sponsor?.click_url ?? null,
      position: row.position,
      tier: row.tier,
      layer: row.layer,
    };
  });
}

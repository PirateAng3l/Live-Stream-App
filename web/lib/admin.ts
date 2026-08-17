import {
  type FixtureRow,
  type FixtureSummary,
  resolveFixtureSummaries,
} from "./fixtures";
import type { StaffProfile } from "./staff";
import { resolveNames } from "./supabase";
import { createSupabaseServerClient } from "./supabase-server";

export interface SchoolOption {
  id: string;
  name: string;
}

export interface TeamOption {
  id: string;
  name: string;
  sport: string;
}

/**
 * Which school an admin page should act on. A school_operator always acts
 * on their own school — there's nothing to choose. A platform_admin has no
 * school of their own, so they pick one first (?school=<id> in the URL);
 * until they do, pages showing this as null render a school picker instead
 * of a form. Pure and unit-tested (admin.test.ts) since it's the one piece
 * of real authorization-adjacent logic here worth pinning down precisely.
 */
export function resolveSchoolContext(
  staff: StaffProfile,
  querySchoolId: string | undefined,
): string | null {
  if (staff.role === "school_operator") return staff.schoolId;
  return querySchoolId && querySchoolId.length > 0 ? querySchoolId : null;
}

export async function loadAllSchools(): Promise<SchoolOption[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("schools").select("id, name").order("name");
  if (error) throw new Error(`Could not load schools: ${error.message}`);
  return data ?? [];
}

export async function loadTeamsForSchool(schoolId: string): Promise<TeamOption[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, sport")
    .eq("school_id", schoolId)
    .order("name");
  if (error) throw new Error(`Could not load teams: ${error.message}`);
  return data ?? [];
}

/**
 * A platform_admin sees every fixture; a school_operator sees only their
 * own school's — same RLS-backed scoping the rest of this app relies on,
 * expressed here as an extra query filter for the school_operator case (RLS
 * would return the same rows even without the filter, but it saves a
 * pointless full-table fetch for a busy platform).
 */
export async function loadFixturesForStaff(staff: StaffProfile): Promise<FixtureSummary[]> {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("fixtures")
    .select(
      "id, sport, scheduled_start, status, host_school_id, home_team_id, away_team_id, youtube_video_id, final_home_score, final_away_score",
    )
    .order("scheduled_start", { ascending: false });

  if (staff.role === "school_operator" && staff.schoolId) {
    query = query.eq("host_school_id", staff.schoolId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load fixtures: ${error.message}`);

  const fixtures: FixtureRow[] = data ?? [];
  if (fixtures.length === 0) return [];

  const { teams, schools } = await resolveNames(fixtures);
  return resolveFixtureSummaries(fixtures, teams, schools);
}

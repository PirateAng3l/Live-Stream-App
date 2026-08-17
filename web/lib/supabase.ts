import { createClient } from "@supabase/supabase-js";
import {
  type FixtureRow,
  type FixtureSummary,
  resolveFixtureSummaries,
  type SchoolRow,
  type TeamRow,
} from "./fixtures";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * The anon key is meant to be public (it ships to every browser) — real
 * access control is the RLS policies in backend/supabase/migrations, not
 * keeping this secret. fixtures/teams/schools are all publicly readable by
 * design (that's the point of a public schedule site); nothing sensitive
 * (like a stream key) is ever fetched through this client.
 */
export const isBackendConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

function getSupabaseClient() {
  if (!isBackendConfigured) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see web/README.md)",
    );
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Two flat follow-up queries (teams, schools) instead of an embedded-
 * relation select, same reasoning as the edge function's db.ts and the
 * Android app's SupabaseClient: simpler typing, doesn't depend on
 * foreign-key constraint names staying stable.
 */
async function resolveNames(
  fixtures: FixtureRow[],
): Promise<{ teams: TeamRow[]; schools: SchoolRow[] }> {
  const supabase = getSupabaseClient();
  const teamIds = Array.from(new Set(fixtures.flatMap((f) => [f.home_team_id, f.away_team_id])));
  const schoolIds = Array.from(new Set(fixtures.map((f) => f.host_school_id)));

  const [teamsResult, schoolsResult] = await Promise.all([
    teamIds.length > 0
      ? supabase.from("teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [] as TeamRow[], error: null }),
    schoolIds.length > 0
      ? supabase.from("schools").select("id, name").in("id", schoolIds)
      : Promise.resolve({ data: [] as SchoolRow[], error: null }),
  ]);

  if (teamsResult.error) throw new Error(`Could not load teams: ${teamsResult.error.message}`);
  if (schoolsResult.error) throw new Error(`Could not load schools: ${schoolsResult.error.message}`);

  return { teams: teamsResult.data ?? [], schools: schoolsResult.data ?? [] };
}

export async function loadFixtures(): Promise<FixtureSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select(
      "id, sport, scheduled_start, status, host_school_id, home_team_id, away_team_id, youtube_video_id, final_home_score, final_away_score",
    )
    .order("scheduled_start", { ascending: false });
  if (error) throw new Error(`Could not load fixtures: ${error.message}`);

  const fixtures: FixtureRow[] = data ?? [];
  if (fixtures.length === 0) return [];

  const { teams, schools } = await resolveNames(fixtures);
  return resolveFixtureSummaries(fixtures, teams, schools);
}

export async function loadFixtureById(id: string): Promise<FixtureSummary | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select(
      "id, sport, scheduled_start, status, host_school_id, home_team_id, away_team_id, youtube_video_id, final_home_score, final_away_score",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load fixture ${id}: ${error.message}`);
  if (!data) return null;

  const fixture: FixtureRow = data;
  const { teams, schools } = await resolveNames([fixture]);
  return resolveFixtureSummaries([fixture], teams, schools)[0] ?? null;
}

// Types + pure display logic for the schedule/replay pages. Deliberately
// has no Supabase import — the I/O (lib/supabase.ts) fetches raw rows and
// calls these functions to shape them, so the logic worth getting right
// (grouping, filtering, joining team/school names, date formatting) is
// testable without a live database. Same split as the edge function's
// provision.ts (logic) vs db.ts (I/O).

export type FixtureStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface FixtureRow {
  id: string;
  sport: string;
  scheduled_start: string;
  status: FixtureStatus;
  host_school_id: string;
  home_team_id: string;
  away_team_id: string;
  youtube_video_id: string | null;
  final_home_score: number | null;
  final_away_score: number | null;
}

export interface TeamRow {
  id: string;
  name: string;
}

export interface SchoolRow {
  id: string;
  name: string;
}

export interface FixtureSummary {
  id: string;
  sport: string;
  scheduledStart: string;
  status: FixtureStatus;
  hostSchoolId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  schoolName: string;
  youtubeVideoId: string | null;
  finalHomeScore: number | null;
  finalAwayScore: number | null;
}

/**
 * Joins the three flat queries lib/supabase.ts makes (fixtures, teams,
 * schools) into display-ready summaries. A missing team/school name (data
 * inconsistency, not expected in practice) falls back to a label rather
 * than crashing the page.
 */
export function resolveFixtureSummaries(
  fixtures: FixtureRow[],
  teams: TeamRow[],
  schools: SchoolRow[],
): FixtureSummary[] {
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const schoolNames = new Map(schools.map((school) => [school.id, school.name]));

  return fixtures.map((fixture) => ({
    id: fixture.id,
    sport: fixture.sport,
    scheduledStart: fixture.scheduled_start,
    status: fixture.status,
    hostSchoolId: fixture.host_school_id,
    homeTeamId: fixture.home_team_id,
    awayTeamId: fixture.away_team_id,
    homeTeamName: teamNames.get(fixture.home_team_id) ?? "Home",
    awayTeamName: teamNames.get(fixture.away_team_id) ?? "Away",
    schoolName: schoolNames.get(fixture.host_school_id) ?? "",
    youtubeVideoId: fixture.youtube_video_id,
    finalHomeScore: fixture.final_home_score,
    finalAwayScore: fixture.final_away_score,
  }));
}

/**
 * The spec's two tabs (7.3.1): Upcoming covers both not-yet-live and
 * currently-live fixtures (a live match is still "in your upcoming view"
 * until it wraps up), Completed is exactly what it says. Cancelled
 * fixtures show in neither — no cancelled tab exists yet.
 */
export function groupFixturesByTab(
  fixtures: FixtureSummary[],
): { upcoming: FixtureSummary[]; completed: FixtureSummary[] } {
  return {
    upcoming: fixtures.filter((f) => f.status === "scheduled" || f.status === "live"),
    completed: fixtures.filter((f) => f.status === "completed"),
  };
}

export function filterBySport(fixtures: FixtureSummary[], sport: string | null): FixtureSummary[] {
  if (!sport) return fixtures;
  return fixtures.filter((f) => f.sport.toLowerCase() === sport.toLowerCase());
}

export function distinctSports(fixtures: FixtureSummary[]): string[] {
  return Array.from(new Set(fixtures.map((f) => f.sport))).sort();
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Always UTC, deliberately — formatting in the visitor's local timezone
 * would mean the server-rendered HTML and the client's first render
 * disagree (Next.js hydration mismatch: the server doesn't know the
 * visitor's timezone). A clearly-labeled fixed timezone is simpler and
 * correct; converting to local time would need a small client component,
 * left for later.
 */
export function formatKickoff(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} · ${hours}:${minutes} UTC`;
}

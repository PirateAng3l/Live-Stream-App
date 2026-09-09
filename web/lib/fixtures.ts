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
  /** Null for a Clean Slate/Event fixture (sport "other") — there's no opposing team. */
  away_team_id: string | null;
  youtube_video_id: string | null;
  final_home_score: number | null;
  final_away_score: number | null;
  hidden_from_viewers: boolean;
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
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string | null;
  schoolName: string;
  youtubeVideoId: string | null;
  finalHomeScore: number | null;
  finalAwayScore: number | null;
  hiddenFromViewers: boolean;
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
    awayTeamName: fixture.away_team_id ? (teamNames.get(fixture.away_team_id) ?? "Away") : null,
    schoolName: schoolNames.get(fixture.host_school_id) ?? "",
    youtubeVideoId: fixture.youtube_video_id,
    finalHomeScore: fixture.final_home_score,
    finalAwayScore: fixture.final_away_score,
    hiddenFromViewers: fixture.hidden_from_viewers,
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

/**
 * A parent who hasn't picked any schools yet sees the same unfiltered list
 * as a signed-out visitor — an empty favourites list is "no preference
 * set", not "show nothing". This is also what makes admins/staff (who have
 * no favourites rows at all) automatically see every fixture without any
 * role check here: the caller just passes whatever favourites lookup came
 * back with, and an empty result falls through to unfiltered either way.
 */
export function filterByFavouriteSchools(
  fixtures: FixtureSummary[],
  favouriteSchoolIds: string[] | null,
): FixtureSummary[] {
  if (!favouriteSchoolIds || favouriteSchoolIds.length === 0) return fixtures;
  const ids = new Set(favouriteSchoolIds);
  return fixtures.filter((f) => ids.has(f.hostSchoolId));
}

export function distinctSports(fixtures: FixtureSummary[]): string[] {
  return Array.from(new Set(fixtures.map((f) => f.sport))).sort();
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * CAT — South Africa's local time, a fixed UTC+2 with no daylight saving —
 * rather than each visitor's own local timezone. A per-visitor local time
 * would mean the server-rendered HTML and the client's first render
 * disagree (Next.js hydration mismatch: the server doesn't know the
 * visitor's timezone); CAT is a fixed offset computed identically on
 * server and client either way, so it doesn't have that problem, and it's
 * what every fixture's host school and viewer here actually is. Used to
 * show UTC instead — technically correct but 2 hours off from the kickoff
 * time everyone here actually means.
 */
const CAT_OFFSET_MS = 2 * 60 * 60 * 1000;

export function formatKickoff(iso: string): string {
  const utcDate = new Date(iso);
  if (Number.isNaN(utcDate.getTime())) return iso;
  const date = new Date(utcDate.getTime() + CAT_OFFSET_MS);
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} · ${hours}:${minutes} CAT`;
}

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/**
 * The inverse of formatKickoff, for the admin fixture form's <input
 * type="datetime-local">: that value ("YYYY-MM-DDTHH:mm") carries no
 * timezone of its own, and the form actions that read it run as Next.js
 * Server Actions — server-side Node, not the admin's browser — so passing
 * it straight to `new Date(value)` parses it in whatever timezone the
 * *server process* happens to run in (commonly UTC in production), not CAT
 * and not the admin's own local timezone either. An admin entering 17:00
 * ended up with a fixture stored as 17:00 UTC and then displayed (correctly,
 * per formatKickoff) as 19:00 CAT — the input needs the same fixed CAT
 * treatment as the display, just applied in reverse.
 */
export function parseCatDatetimeLocal(value: string): Date {
  const match = DATETIME_LOCAL_PATTERN.exec(value);
  if (!match) return new Date(NaN);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - CAT_OFFSET_MS);
}

/**
 * The inverse of parseCatDatetimeLocal, for prefilling the edit form's
 * datetime-local input from a fixture's already-stored UTC instant — reads
 * it back out as CAT wall-clock time using UTC getters on the shifted
 * instant (same approach as formatKickoff), not the browser's local Date
 * getters, so the value shown for editing matches what formatKickoff
 * displays regardless of the admin's own browser timezone.
 */
export function toCatDatetimeLocalValue(iso: string): string {
  const utcDate = new Date(iso);
  if (Number.isNaN(utcDate.getTime())) return "";
  const date = new Date(utcDate.getTime() + CAT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())}`;
}

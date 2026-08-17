import { describe, expect, it } from "vitest";
import {
  distinctSports,
  filterBySport,
  type FixtureRow,
  formatKickoff,
  groupFixturesByTab,
  resolveFixtureSummaries,
  type SchoolRow,
  type TeamRow,
} from "./fixtures";

function fixtureRow(overrides: Partial<FixtureRow> = {}): FixtureRow {
  return {
    id: "fixture-1",
    sport: "rugby",
    scheduled_start: "2026-08-20T14:30:00Z",
    status: "scheduled",
    host_school_id: "school-1",
    home_team_id: "team-home",
    away_team_id: "team-away",
    youtube_video_id: null,
    final_home_score: null,
    final_away_score: null,
    ...overrides,
  };
}

const TEAMS: TeamRow[] = [
  { id: "team-home", name: "Riverside 1st XV" },
  { id: "team-away", name: "Oak Park 1st XV" },
];
const SCHOOLS: SchoolRow[] = [{ id: "school-1", name: "Riverside High" }];

describe("resolveFixtureSummaries", () => {
  it("joins team and school names onto each fixture", () => {
    const summaries = resolveFixtureSummaries([fixtureRow()], TEAMS, SCHOOLS);
    expect(summaries).toEqual([
      {
        id: "fixture-1",
        sport: "rugby",
        scheduledStart: "2026-08-20T14:30:00Z",
        status: "scheduled",
        hostSchoolId: "school-1",
        homeTeamName: "Riverside 1st XV",
        awayTeamName: "Oak Park 1st XV",
        schoolName: "Riverside High",
        youtubeVideoId: null,
        finalHomeScore: null,
        finalAwayScore: null,
      },
    ]);
  });

  it("falls back to a label instead of crashing when a team/school is missing", () => {
    const summaries = resolveFixtureSummaries([fixtureRow()], [], []);
    expect(summaries[0]?.homeTeamName).toBe("Home");
    expect(summaries[0]?.awayTeamName).toBe("Away");
    expect(summaries[0]?.schoolName).toBe("");
  });
});

describe("groupFixturesByTab", () => {
  it("puts scheduled and live fixtures under upcoming, completed under completed", () => {
    const summaries = resolveFixtureSummaries(
      [
        fixtureRow({ id: "a", status: "scheduled" }),
        fixtureRow({ id: "b", status: "live" }),
        fixtureRow({ id: "c", status: "completed" }),
        fixtureRow({ id: "d", status: "cancelled" }),
      ],
      TEAMS,
      SCHOOLS,
    );
    const grouped = groupFixturesByTab(summaries);
    expect(grouped.upcoming.map((f) => f.id)).toEqual(["a", "b"]);
    expect(grouped.completed.map((f) => f.id)).toEqual(["c"]);
  });
});

describe("filterBySport", () => {
  it("is case-insensitive and passes everything through when no sport is given", () => {
    const summaries = resolveFixtureSummaries(
      [fixtureRow({ id: "a", sport: "Rugby" }), fixtureRow({ id: "b", sport: "netball" })],
      TEAMS,
      SCHOOLS,
    );
    expect(filterBySport(summaries, "rugby").map((f) => f.id)).toEqual(["a"]);
    expect(filterBySport(summaries, null).map((f) => f.id)).toEqual(["a", "b"]);
  });
});

describe("distinctSports", () => {
  it("de-duplicates and sorts", () => {
    const summaries = resolveFixtureSummaries(
      [
        fixtureRow({ id: "a", sport: "rugby" }),
        fixtureRow({ id: "b", sport: "netball" }),
        fixtureRow({ id: "c", sport: "rugby" }),
      ],
      TEAMS,
      SCHOOLS,
    );
    expect(distinctSports(summaries)).toEqual(["netball", "rugby"]);
  });
});

describe("formatKickoff", () => {
  it("formats in UTC regardless of the runtime's local timezone", () => {
    expect(formatKickoff("2026-08-20T14:05:00Z")).toBe("20 Aug · 14:05 UTC");
  });

  it("returns the raw input instead of throwing on an unparseable date", () => {
    expect(formatKickoff("not-a-date")).toBe("not-a-date");
  });
});

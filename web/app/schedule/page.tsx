import Link from "next/link";
import { BackendNotConfigured, LoadError, StatusBadge } from "../_components";
import { getCurrentParent } from "@/lib/auth";
import { loadFavouriteSchoolIds } from "@/lib/favourites-server";
import {
  distinctSports,
  filterByFavouriteSchools,
  filterBySport,
  type FixtureSummary,
  formatKickoff,
  groupFixturesByTab,
} from "@/lib/fixtures";
import { isBackendConfigured, loadFixtures } from "@/lib/supabase";

// Always fetch fresh — the schedule page is read from the same table
// operators are actively updating (status flips to live/completed as
// matches happen), so this shouldn't be statically cached at build time.
export const dynamic = "force-dynamic";

type Tab = "upcoming" | "completed";

interface SchedulePageProps {
  searchParams: { tab?: string; sport?: string };
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  if (!isBackendConfigured) {
    return <BackendNotConfigured />;
  }

  const tab: Tab = searchParams.tab === "completed" ? "completed" : "upcoming";
  const sportFilter = searchParams.sport ?? null;

  let fixtures: FixtureSummary[];
  try {
    fixtures = await loadFixtures();
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  // A signed-in parent with favourite schools only sees those schools'
  // fixtures here; everyone else (signed-out visitors, a parent with no
  // favourites picked yet, and staff — who have no favourites rows at all)
  // sees the full list, same as before this feature existed.
  const parent = await getCurrentParent();
  if (parent) {
    try {
      const favouriteSchoolIds = await loadFavouriteSchoolIds(parent.id);
      fixtures = filterByFavouriteSchools(fixtures, favouriteSchoolIds);
    } catch {
      // Favourites is a filter on top of the schedule, not the schedule
      // itself — if this lookup fails, fall back to the unfiltered list
      // rather than taking down the whole page over it.
    }
  }

  const sports = distinctSports(fixtures);
  const grouped = groupFixturesByTab(fixtures);
  const visible = filterBySport(grouped[tab], sportFilter);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Live Matches</h1>

      <div className="mb-4 flex gap-2">
        <TabLink label="Upcoming" active={tab === "upcoming"} href={buildHref("upcoming", sportFilter)} />
        <TabLink label="Completed" active={tab === "completed"} href={buildHref("completed", sportFilter)} />
      </div>

      {sports.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <SportChip label="All sports" active={sportFilter === null} href={buildHref(tab, null)} />
          {sports.map((sport) => (
            <SportChip
              key={sport}
              label={sport}
              active={sportFilter === sport}
              href={buildHref(tab, sport)}
            />
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-textsecondary">
          No {tab} fixtures{sportFilter ? ` for ${sportFilter}` : ""}.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((fixture) => (
            <FixtureRow key={fixture.id} fixture={fixture} />
          ))}
        </ul>
      )}
    </div>
  );
}

function buildHref(tab: Tab, sport: string | null): string {
  const params = new URLSearchParams();
  if (tab !== "upcoming") params.set("tab", tab);
  if (sport) params.set("sport", sport);
  const query = params.toString();
  return query ? `/schedule?${query}` : "/schedule";
}

function TabLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
        active ? "bg-accent text-white" : "bg-panel text-textsecondary"
      }`}
    >
      {label}
    </Link>
  );
}

function SportChip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs capitalize ${
        active ? "border-accent text-accent" : "border-white/10 text-textsecondary"
      }`}
    >
      {label}
    </Link>
  );
}

function FixtureRow({ fixture }: { fixture: FixtureSummary }) {
  const hasFinalScore = fixture.status === "completed" &&
    fixture.finalHomeScore !== null &&
    fixture.finalAwayScore !== null;

  return (
    <li>
      <Link
        href={`/matches/${fixture.id}`}
        className="block rounded-lg border border-white/10 bg-panel px-4 py-3 transition-colors hover:border-accent"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-textsecondary">{fixture.sport}</span>
          <StatusBadge status={fixture.status} />
        </div>
        <div className="mt-1 font-semibold">
          {fixture.homeTeamName} <span className="text-textsecondary">vs</span> {fixture.awayTeamName}
        </div>
        <div className="mt-1 text-sm text-textsecondary">
          {fixture.schoolName} · {formatKickoff(fixture.scheduledStart)}
          {hasFinalScore ? ` · Final: ${fixture.finalHomeScore}-${fixture.finalAwayScore}` : ""}
        </div>
      </Link>
    </li>
  );
}

import Link from "next/link";
import { StatusBadge } from "./_components";
import { getCurrentParent } from "@/lib/auth";
import { loadFavouriteSchoolIds } from "@/lib/favourites-server";
import { filterByFavouriteSchools, type FixtureSummary, formatKickoff, groupFixturesByTab } from "@/lib/fixtures";
import { isBackendConfigured, loadFixtures } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PREVIEW_COUNT = 3;

export default async function HomePage() {
  // The landing page's job is to sell the pitch even if the schedule data
  // can't be reached — a broken preview section shouldn't take out the
  // whole homepage the way it would on /schedule (whose entire reason to
  // exist IS that data). Fails soft to an empty list instead of LoadError.
  let upcoming: FixtureSummary[] = [];
  if (isBackendConfigured) {
    try {
      const fixtures = await loadFixtures();
      let filtered = fixtures;

      // Same favourite-schools filter as /schedule, applied before the
      // preview slice so a parent's "Coming up" teaser matches what they'd
      // see on the full schedule, not the platform-wide list.
      const parent = await getCurrentParent();
      if (parent) {
        try {
          const favouriteSchoolIds = await loadFavouriteSchoolIds(parent.id);
          filtered = filterByFavouriteSchools(fixtures, favouriteSchoolIds);
        } catch {
          filtered = fixtures;
        }
      }

      upcoming = groupFixturesByTab(filtered).upcoming.slice(0, PREVIEW_COUNT);
    } catch {
      upcoming = [];
    }
  }

  return (
    <div>
      <section className="py-12 text-center sm:py-20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Live school sports streaming
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Every game, streamed live — for the families who can&apos;t be in the stands.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-textsecondary">
          Open Door Live brings school sports to the parents, grandparents, and supporters who
          can&apos;t make it to the sideline — one phone, one crew member, a real broadcast.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/schedule"
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white"
          >
            View the schedule
          </Link>
          <Link
            href="/about"
            className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-textprimary hover:border-accent"
          >
            About us
          </Link>
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Coming up</h2>
            <Link href="/schedule" className="text-sm font-semibold text-accent">
              Full schedule →
            </Link>
          </div>
          <ul className="space-y-3">
            {upcoming.map((fixture) => (
              <li key={fixture.id}>
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
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

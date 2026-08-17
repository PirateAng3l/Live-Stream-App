import Link from "next/link";
import { LoadError, StatusBadge } from "../_components";
import { loadFixturesForStaff } from "@/lib/admin";
import { formatKickoff } from "@/lib/fixtures";
import { getCurrentStaffProfile } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function AdminFixturesPage() {
  // Layout already redirects if this is null; re-fetching here (cached
  // per-request by getCurrentStaffProfile's cache() wrapper — this is not
  // a second round trip) is just how the staff profile gets to this page.
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;

  let fixtures;
  try {
    fixtures = await loadFixturesForStaff(staff);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fixtures</h1>
        <Link href="/admin/fixtures/new" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
          + New fixture
        </Link>
      </div>

      {fixtures.length === 0 ? (
        <p className="text-textsecondary">
          No fixtures yet.{" "}
          <Link href="/admin/fixtures/new" className="text-accent">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {fixtures.map((fixture) => (
            <li
              key={fixture.id}
              className="rounded-lg border border-white/10 bg-panel px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-textsecondary">{fixture.sport}</span>
                <StatusBadge status={fixture.status} />
              </div>
              <div className="mt-1 font-semibold">
                {fixture.homeTeamName} <span className="text-textsecondary">vs</span> {fixture.awayTeamName}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-textsecondary">
                <span>{fixture.schoolName}</span>
                <span>·</span>
                <span>{formatKickoff(fixture.scheduledStart)}</span>
                <span>·</span>
                {fixture.youtubeVideoId ? (
                  <span className="text-ok">Ready to stream</span>
                ) : (
                  <span>Provisioning…</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

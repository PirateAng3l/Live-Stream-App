import { notFound } from "next/navigation";
import { LoadError, StatusBadge } from "../../../_components";
import { formatKickoff } from "@/lib/fixtures";
import { loadFixtureSponsors, loadSponsorsForSchool } from "@/lib/sponsors-server";
import { sponsorLayerLabel, sponsorPositionLabel, sponsorTierLabel } from "@/lib/sponsors";
import { getCurrentStaffProfile } from "@/lib/staff";
import { loadFixtureById } from "@/lib/supabase";
import { AssignSponsorForm, RemoveSponsorForm } from "./sponsor-forms";

export const dynamic = "force-dynamic";

interface FixtureDetailPageProps {
  params: { id: string };
}

export default async function FixtureDetailPage({ params }: FixtureDetailPageProps) {
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;

  let fixture;
  try {
    fixture = await loadFixtureById(params.id);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }
  if (!fixture) notFound();

  // A school_operator has no business seeing (let alone getting sponsor-
  // assignment controls for) another school's fixture — RLS already stops
  // them reading a mismatched fixture at all in practice, but this is a
  // clean 404 instead of a confusing empty page if that ever changes.
  if (staff.role === "school_operator" && staff.schoolId !== fixture.hostSchoolId) {
    notFound();
  }

  let sponsors;
  let assignments;
  try {
    [sponsors, assignments] = await Promise.all([
      loadSponsorsForSchool(fixture.hostSchoolId),
      loadFixtureSponsors(fixture.id),
    ]);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-textsecondary">
        {fixture.sport} · {fixture.schoolName}
      </p>
      <div className="mt-1 flex items-center gap-3">
        <h1 className="text-2xl font-bold">
          {fixture.homeTeamName} <span className="text-textsecondary">vs</span> {fixture.awayTeamName}
        </h1>
        <StatusBadge status={fixture.status} />
      </div>
      <p className="mt-1 text-sm text-textsecondary">{formatKickoff(fixture.scheduledStart)}</p>
      <p className="mt-1 text-sm text-textsecondary">
        {fixture.youtubeVideoId ? "Ready to stream" : "Provisioning…"}
      </p>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Sponsors on this fixture</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-textsecondary">No sponsors assigned yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {assignments.map((assignment) => (
              <li
                key={`${assignment.sponsorId}-${assignment.layer}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-panel px-4 py-3"
              >
                <div>
                  <span className="font-semibold">{assignment.sponsorName}</span>
                  <span className="ml-2 text-xs uppercase tracking-wide text-textsecondary">
                    {sponsorTierLabel(assignment.tier)} · {sponsorPositionLabel(assignment.position)} ·{" "}
                    {sponsorLayerLabel(assignment.layer)}
                  </span>
                </div>
                <RemoveSponsorForm fixtureId={fixture.id} sponsorId={assignment.sponsorId} layer={assignment.layer} />
              </li>
            ))}
          </ul>
        )}

        <h3 className="mb-3 text-sm font-semibold text-textsecondary">Assign a sponsor</h3>
        <div className="max-w-sm">
          <AssignSponsorForm fixtureId={fixture.id} sponsors={sponsors} />
        </div>
      </div>
    </div>
  );
}

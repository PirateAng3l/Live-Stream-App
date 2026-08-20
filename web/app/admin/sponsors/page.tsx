import Link from "next/link";
import { SchoolPicker } from "../_school-picker";
import { LoadError } from "../../_components";
import { loadAllSchools, resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { loadSponsorsForSchool } from "@/lib/sponsors-server";
import { sponsorPositionLabel, sponsorTierLabel } from "@/lib/sponsors";
import { SponsorRowActions } from "./sponsor-row-actions";

export const dynamic = "force-dynamic";

interface AdminSponsorsPageProps {
  searchParams: { school?: string };
}

export default async function AdminSponsorsPage({ searchParams }: AdminSponsorsPageProps) {
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;

  const schoolId = resolveSchoolContext(staff, searchParams.school);

  if (!schoolId) {
    let schools;
    try {
      schools = await loadAllSchools();
    } catch (error) {
      return <LoadError message={(error as Error).message} />;
    }
    return <SchoolPicker schools={schools} basePath="/admin/sponsors" title="Sponsors" />;
  }

  let sponsors;
  try {
    sponsors = await loadSponsorsForSchool(schoolId);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  const newSponsorHref =
    staff.role === "platform_admin" ? `/admin/sponsors/new?school=${schoolId}` : "/admin/sponsors/new";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sponsors</h1>
        <Link
          href={newSponsorHref}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          + New sponsor
        </Link>
      </div>

      {sponsors.length === 0 ? (
        <p className="text-textsecondary">
          No sponsors yet.{" "}
          <Link href={newSponsorHref} className="text-accent">
            Add one
          </Link>
          . Once a sponsor exists it can be assigned to individual fixtures from that
          fixture&apos;s page.
        </p>
      ) : (
        <ul className="space-y-2">
          {sponsors.map((sponsor) => (
            <li
              key={sponsor.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-panel px-4 py-3"
            >
              <span>{sponsor.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs uppercase tracking-wide text-textsecondary">
                  {sponsorTierLabel(sponsor.tier)} · {sponsorPositionLabel(sponsor.defaultPosition)}
                </span>
                <SponsorRowActions sponsorId={sponsor.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

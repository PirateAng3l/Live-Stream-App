import Link from "next/link";
import { SchoolPicker } from "../_school-picker";
import { LoadError } from "../../_components";
import { loadAllSchools, loadTeamsForSchool, resolveSchoolContext } from "@/lib/admin";
import { sportLabel } from "@/lib/sports";
import { getCurrentStaffProfile } from "@/lib/staff";

export const dynamic = "force-dynamic";

interface AdminTeamsPageProps {
  searchParams: { school?: string };
}

export default async function AdminTeamsPage({ searchParams }: AdminTeamsPageProps) {
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
    return <SchoolPicker schools={schools} basePath="/admin/teams" title="Teams" />;
  }

  let teams;
  try {
    teams = await loadTeamsForSchool(schoolId);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  const newTeamHref = staff.role === "platform_admin" ? `/admin/teams/new?school=${schoolId}` : "/admin/teams/new";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams</h1>
        <Link href={newTeamHref} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
          + New team
        </Link>
      </div>

      {teams.length === 0 ? (
        <p className="text-textsecondary">
          No teams yet — you&apos;ll need at least two before creating a fixture.{" "}
          <Link href={newTeamHref} className="text-accent">
            Add one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-panel px-4 py-3"
            >
              <span>{team.name}</span>
              <span className="text-xs uppercase tracking-wide text-textsecondary">
                {sportLabel(team.sport)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

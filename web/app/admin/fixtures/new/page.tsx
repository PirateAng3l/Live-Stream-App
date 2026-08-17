import Link from "next/link";
import { SchoolPicker } from "../../_school-picker";
import { LoadError } from "../../../_components";
import { loadAllSchools, loadTeamsForSchool, resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { NewFixtureForm } from "./new-fixture-form";

export const dynamic = "force-dynamic";

interface NewFixturePageProps {
  searchParams: { school?: string };
}

export default async function NewFixturePage({ searchParams }: NewFixturePageProps) {
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
    return <SchoolPicker schools={schools} basePath="/admin/fixtures/new" title="New fixture" />;
  }

  let teams;
  try {
    teams = await loadTeamsForSchool(schoolId);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  if (teams.length < 2) {
    const newTeamHref = staff.role === "platform_admin" ? `/admin/teams/new?school=${schoolId}` : "/admin/teams/new";
    return (
      <p className="text-textsecondary">
        You need at least two teams for this school before creating a fixture.{" "}
        <Link href={newTeamHref} className="text-accent">
          Add a team
        </Link>
        .
      </p>
    );
  }

  return <NewFixtureForm schoolId={schoolId} teams={teams} />;
}

import { SchoolPicker } from "../../_school-picker";
import { LoadError } from "../../../_components";
import { loadAllSchools, resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { NewTeamForm } from "./new-team-form";

export const dynamic = "force-dynamic";

interface NewTeamPageProps {
  searchParams: { school?: string };
}

export default async function NewTeamPage({ searchParams }: NewTeamPageProps) {
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
    return <SchoolPicker schools={schools} basePath="/admin/teams/new" title="New team" />;
  }

  return <NewTeamForm schoolId={schoolId} />;
}

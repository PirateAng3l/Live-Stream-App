import { SchoolPicker } from "../../_school-picker";
import { LoadError } from "../../../_components";
import { loadAllSchools, resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { NewSponsorForm } from "./new-sponsor-form";

export const dynamic = "force-dynamic";

interface NewSponsorPageProps {
  searchParams: { school?: string };
}

export default async function NewSponsorPage({ searchParams }: NewSponsorPageProps) {
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
    return <SchoolPicker schools={schools} basePath="/admin/sponsors/new" title="New sponsor" />;
  }

  return <NewSponsorForm schoolId={schoolId} />;
}

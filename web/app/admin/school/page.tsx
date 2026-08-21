import { SchoolPicker } from "../_school-picker";
import { LoadError } from "../../_components";
import { loadAllSchools, loadSchoolById, resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { SchoolLogoForm } from "./school-logo-form";

export const dynamic = "force-dynamic";

interface SchoolPageProps {
  searchParams: { school?: string };
}

export default async function SchoolPage({ searchParams }: SchoolPageProps) {
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
    return <SchoolPicker schools={schools} basePath="/admin/school" title="School profile" />;
  }

  let school;
  try {
    school = await loadSchoolById(schoolId);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }
  if (!school) return <LoadError message="School not found" />;

  return <SchoolLogoForm school={school} />;
}

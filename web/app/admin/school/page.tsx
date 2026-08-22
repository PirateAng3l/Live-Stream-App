import { SchoolPicker } from "../_school-picker";
import { LoadError } from "../../_components";
import { loadAllSchools, loadSchoolById, resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { ConsentForm } from "./consent-form";
import { OperatorInviteForm } from "./operator-invite-form";
import { ResendInviteForm } from "./resend-invite-form";
import { SchoolLogoForm } from "./school-logo-form";

export const dynamic = "force-dynamic";

interface SchoolPageProps {
  searchParams: { school?: string; invite_email?: string };
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

  return (
    <div>
      <ConsentForm school={school} />
      <SchoolLogoForm school={school} />
      {/* Inviting a login is a platform_admin action, same as creating the
          school itself — a school_operator managing their own logo has no
          reason to invite anyone here. */}
      {staff.role === "platform_admin" && (
        <>
          <OperatorInviteForm school={school} defaultEmail={searchParams.invite_email} />
          <ResendInviteForm />
        </>
      )}
    </div>
  );
}

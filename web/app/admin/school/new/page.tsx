import { redirect } from "next/navigation";
import { getCurrentStaffProfile } from "@/lib/staff";
import { NewSchoolForm } from "./new-school-form";

export const dynamic = "force-dynamic";

export default async function NewSchoolPage() {
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;
  // A school_operator already has a school and never sees the link that
  // leads here — createSchoolAction re-checks this too, but bouncing them
  // straight back is friendlier than a raw form error on page load.
  if (staff.role !== "platform_admin") redirect("/admin/school");

  return <NewSchoolForm />;
}

import { notFound } from "next/navigation";
import { LoadError } from "../../../../_components";
import { loadTeamById } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { EditTeamForm } from "./edit-team-form";

export const dynamic = "force-dynamic";

interface EditTeamPageProps {
  params: { id: string };
}

export default async function EditTeamPage({ params }: EditTeamPageProps) {
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;

  let team;
  try {
    team = await loadTeamById(params.id);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }
  if (!team) notFound();

  if (staff.role === "school_operator" && staff.schoolId !== team.schoolId) {
    notFound();
  }

  return <EditTeamForm team={team} />;
}

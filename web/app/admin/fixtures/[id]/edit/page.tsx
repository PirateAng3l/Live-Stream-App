import { notFound } from "next/navigation";
import { LoadError } from "../../../../_components";
import { loadTeamsForSchool } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { loadFixtureById } from "@/lib/supabase";
import { EditFixtureForm } from "./edit-fixture-form";

export const dynamic = "force-dynamic";

interface EditFixturePageProps {
  params: { id: string };
}

export default async function EditFixturePage({ params }: EditFixturePageProps) {
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;

  let fixture;
  try {
    fixture = await loadFixtureById(params.id);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }
  if (!fixture) notFound();

  // Same reasoning as the fixture detail page: RLS already stops a mismatched
  // school_operator from reading this fixture at all, but a clean 404 here
  // is friendlier than a confusing edit form for someone else's fixture.
  if (staff.role === "school_operator" && staff.schoolId !== fixture.hostSchoolId) {
    notFound();
  }

  let teams;
  try {
    teams = await loadTeamsForSchool(fixture.hostSchoolId);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  return <EditFixtureForm fixture={fixture} teams={teams} />;
}

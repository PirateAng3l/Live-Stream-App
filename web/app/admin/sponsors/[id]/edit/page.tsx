import { notFound } from "next/navigation";
import { LoadError } from "../../../../_components";
import { loadSponsorById } from "@/lib/sponsors-server";
import { getCurrentStaffProfile } from "@/lib/staff";
import { EditSponsorForm } from "./edit-sponsor-form";
import { SponsorLogoForm } from "./sponsor-logo-form";

export const dynamic = "force-dynamic";

interface EditSponsorPageProps {
  params: { id: string };
}

export default async function EditSponsorPage({ params }: EditSponsorPageProps) {
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;

  let sponsor;
  try {
    sponsor = await loadSponsorById(params.id);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }
  if (!sponsor) notFound();

  if (staff.role === "school_operator" && staff.schoolId !== sponsor.schoolId) {
    notFound();
  }

  return (
    <div>
      <SponsorLogoForm sponsor={sponsor} />
      <EditSponsorForm sponsor={sponsor} />
    </div>
  );
}

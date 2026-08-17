import Link from "next/link";
import { SchoolPicker } from "../../_school-picker";
import { LoadError } from "../../../_components";
import { loadAllSchools, loadTeamsForSchool, resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { isSubscriptionOperational, subscriptionStatusLabel } from "@/lib/subscriptions";
import { loadSubscriptionForSchool } from "@/lib/subscriptions-server";
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

  // Same subscription check the Server Action re-runs before actually
  // inserting (and RLS enforces regardless) — showing it here too means a
  // lapsed school sees why before filling out a form that would just be
  // rejected at submit time.
  const subscription = await loadSubscriptionForSchool(schoolId).catch(() => null);
  if (subscription && !isSubscriptionOperational(subscription.status)) {
    return (
      <p className="text-textsecondary">
        This school&apos;s subscription is {subscriptionStatusLabel(subscription.status).toLowerCase()} — new
        fixtures can&apos;t be created until it&apos;s renewed. Past matches stay watchable regardless; this only
        affects scheduling new ones.
      </p>
    );
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

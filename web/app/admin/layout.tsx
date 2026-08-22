import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { loadNewConcernReportCount } from "@/lib/concern-reports";
import { loadPendingSchoolRequestCount } from "@/lib/school-requests";
import { getCurrentStaffProfile } from "@/lib/staff";
import { loadSubscriptionForSchool } from "@/lib/subscriptions-server";
import { SubscriptionBadge } from "./_subscription-badge";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getCurrentStaffProfile();
  if (!staff) {
    redirect("/sign-in?redirect=/admin");
  }

  // A platform_admin has no single school, so there's no one subscription
  // to show here — same reasoning as why they get a school picker
  // elsewhere instead of an implicit school. A load failure here shouldn't
  // take out the whole admin panel, so it fails soft to "no badge" rather
  // than LoadError-ing every /admin page.
  const subscription =
    staff.role === "school_operator" && staff.schoolId
      ? await loadSubscriptionForSchool(staff.schoolId).catch(() => null)
      : null;

  // Same "fail soft, no badge" treatment — a school_operator never queries
  // this at all (school_signup_requests_admin_manage would just return 0
  // rows for them anyway, no point spending the round trip).
  const pendingRequestCount =
    staff.role === "platform_admin" ? await loadPendingSchoolRequestCount().catch(() => 0) : 0;
  const newConcernReportCount =
    staff.role === "platform_admin" ? await loadNewConcernReportCount().catch(() => 0) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <nav className="flex gap-4 text-sm font-semibold">
          <Link href="/admin" className="hover:text-accent">
            Fixtures
          </Link>
          <Link href="/admin/teams" className="hover:text-accent">
            Teams
          </Link>
          <Link href="/admin/sponsors" className="hover:text-accent">
            Sponsors
          </Link>
          <Link href="/admin/school" className="hover:text-accent">
            School
          </Link>
          {staff.role === "platform_admin" && (
            <>
              <Link href="/admin/school-requests" className="hover:text-accent">
                Requests{pendingRequestCount > 0 ? ` (${pendingRequestCount})` : ""}
              </Link>
              <Link href="/admin/concern-reports" className="hover:text-accent">
                Concerns{newConcernReportCount > 0 ? ` (${newConcernReportCount})` : ""}
              </Link>
            </>
          )}
        </nav>
        <span className="flex items-center gap-2 text-xs text-textsecondary">
          {staff.role === "platform_admin" ? "Platform admin" : "School operator"}
          {staff.email ? ` · ${staff.email}` : ""}
          {subscription && <SubscriptionBadge status={subscription.status} />}
        </span>
      </div>
      {children}
    </div>
  );
}

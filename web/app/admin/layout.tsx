import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
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

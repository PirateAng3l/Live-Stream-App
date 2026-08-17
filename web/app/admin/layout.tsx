import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentStaffProfile } from "@/lib/staff";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getCurrentStaffProfile();
  if (!staff) {
    redirect("/sign-in?redirect=/admin");
  }

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
        <span className="text-xs text-textsecondary">
          {staff.role === "platform_admin" ? "Platform admin" : "School operator"}
          {staff.email ? ` · ${staff.email}` : ""}
        </span>
      </div>
      {children}
    </div>
  );
}

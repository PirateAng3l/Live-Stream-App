import Link from "next/link";
import { redirect } from "next/navigation";
import { LoadError } from "../../_components";
import { loadSchoolRequests } from "@/lib/school-requests";
import { getCurrentStaffProfile } from "@/lib/staff";
import { SchoolRequestRow } from "./school-request-row";

export const dynamic = "force-dynamic";

export default async function SchoolRequestsPage() {
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;
  // A school_operator has no reason to review other schools' requests —
  // same reasoning as school-requests_admin_manage (migration 0007) being
  // platform_admin only.
  if (staff.role !== "platform_admin") redirect("/admin");

  let requests;
  try {
    requests = await loadSchoolRequests();
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  const pending = requests.filter((request) => request.status === "pending");
  const reviewed = requests.filter((request) => request.status !== "pending");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">School requests</h1>

      {pending.length === 0 ? (
        <p className="mb-8 text-textsecondary">No pending requests.</p>
      ) : (
        <ul className="mb-8 space-y-3">
          {pending.map((request) => (
            <SchoolRequestRow key={request.id} request={request} />
          ))}
        </ul>
      )}

      {reviewed.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-textsecondary">Reviewed</h2>
          <ul className="space-y-2">
            {reviewed.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm"
              >
                <span className="text-textsecondary">
                  {request.schoolName} — {request.contactEmail}
                </span>
                <span className="flex items-center gap-3">
                  {request.status === "approved" && request.resultingSchoolId && (
                    <Link
                      href={`/admin/school?school=${request.resultingSchoolId}&invite_email=${encodeURIComponent(request.contactEmail)}`}
                      className="text-accent hover:underline"
                    >
                      Invite operator
                    </Link>
                  )}
                  <span className={request.status === "approved" ? "text-ok" : "text-textsecondary"}>
                    {request.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

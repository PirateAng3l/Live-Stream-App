import { redirect } from "next/navigation";
import { LoadError } from "../../_components";
import { loadConcernReports } from "@/lib/concern-reports";
import { getCurrentStaffProfile } from "@/lib/staff";
import { ConcernReportRow } from "./concern-report-row";

export const dynamic = "force-dynamic";

export default async function ConcernReportsPage() {
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;
  // Same reasoning as school-requests: a school_operator has no reason to
  // review reports about schools that aren't them, and a report doesn't
  // reliably say which school it's about anyway (fixture_id is optional).
  if (staff.role !== "platform_admin") redirect("/admin");

  let reports;
  try {
    reports = await loadConcernReports();
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  const open = reports.filter((report) => report.status === "new");
  const closed = reports.filter((report) => report.status !== "new");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Concern reports</h1>

      {open.length === 0 ? (
        <p className="mb-8 text-textsecondary">No open reports.</p>
      ) : (
        <ul className="mb-8 space-y-3">
          {open.map((report) => (
            <ConcernReportRow key={report.id} report={report} />
          ))}
        </ul>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-textsecondary">Reviewed / resolved</h2>
          <ul className="space-y-2">
            {closed.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm"
              >
                <span className="text-textsecondary">
                  {report.reporterName || "Anonymous"} — {report.reporterEmail}
                </span>
                <span className={report.status === "resolved" ? "text-ok" : "text-textsecondary"}>
                  {report.status}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

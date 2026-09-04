import { redirect } from "next/navigation";
import { LoadError } from "../../_components";
import { loadDirectory } from "@/lib/directory";
import { getCurrentStaffProfile } from "@/lib/staff";
import { subscriptionStatusLabel } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

export default async function DirectoryPage() {
  const staff = await getCurrentStaffProfile();
  if (!staff) return null;
  // Every school's contact details, every operator, and every parent
  // across the whole platform — a school_operator has no reason to see
  // other schools' accounts, same reasoning as school-requests/concern-reports.
  if (staff.role !== "platform_admin") redirect("/admin");

  let directory;
  try {
    directory = await loadDirectory();
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  const { schools, operators, parents } = directory;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Directory</h1>
        <p className="mt-1 text-sm text-textsecondary">
          Every school, operator, and parent account on the platform, read live from the database — this
          page always shows the current state, not a snapshot.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Schools ({schools.length})</h2>
        {schools.length === 0 ? (
          <p className="text-textsecondary">No schools yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-panel">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-textsecondary">
                  <th className="px-4 py-3 font-semibold">School</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Subscription</th>
                  <th className="px-4 py-3 font-semibold">Consent</th>
                  <th className="px-4 py-3 font-semibold">Operators</th>
                  <th className="px-4 py-3 font-semibold">Followers</th>
                  <th className="px-4 py-3 font-semibold">Since</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 font-semibold text-textprimary">{school.name}</td>
                    <td className="px-4 py-3 text-textsecondary">
                      {school.contactEmail ?? "—"}
                      {school.contactPhone ? ` · ${school.contactPhone}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      {school.subscriptionStatus ? (
                        subscriptionStatusLabel(school.subscriptionStatus)
                      ) : (
                        <span className="text-textsecondary">No subscription row</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {school.consentConfirmedAt ? (
                        <span className="text-ok">Confirmed {formatDate(school.consentConfirmedAt)}</span>
                      ) : (
                        <span className="text-live">Not confirmed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-textsecondary">{school.operatorCount}</td>
                    <td className="px-4 py-3 text-textsecondary">{school.followerCount}</td>
                    <td className="px-4 py-3 text-textsecondary">{formatDate(school.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">School operators ({operators.length})</h2>
        {operators.length === 0 ? (
          <p className="text-textsecondary">No operator accounts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-panel">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-textsecondary">
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">School</th>
                  <th className="px-4 py-3 font-semibold">Since</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => (
                  <tr key={op.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 font-semibold text-textprimary">{op.email ?? "—"}</td>
                    <td className="px-4 py-3 text-textsecondary">{op.fullName ?? "—"}</td>
                    <td className="px-4 py-3 text-textsecondary">{op.schoolName ?? "—"}</td>
                    <td className="px-4 py-3 text-textsecondary">{formatDate(op.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Parents ({parents.length})</h2>
        {parents.length === 0 ? (
          <p className="text-textsecondary">No parent accounts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-panel">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-textsecondary">
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Follows</th>
                  <th className="px-4 py-3 font-semibold">Since</th>
                </tr>
              </thead>
              <tbody>
                {parents.map((parent) => (
                  <tr key={parent.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 font-semibold text-textprimary">{parent.email ?? "—"}</td>
                    <td className="px-4 py-3 text-textsecondary">{parent.fullName ?? "—"}</td>
                    <td className="px-4 py-3 text-textsecondary">
                      {parent.favouriteSchoolNames.length > 0 ? parent.favouriteSchoolNames.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-textsecondary">{formatDate(parent.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

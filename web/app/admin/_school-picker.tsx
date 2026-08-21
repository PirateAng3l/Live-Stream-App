import Link from "next/link";
import type { SchoolOption } from "@/lib/admin";

/**
 * Shown to a platform_admin (who has no school of their own) before they
 * can manage teams or create a fixture for a specific school. A
 * school_operator never sees this — resolveSchoolContext (lib/admin.ts)
 * always resolves to their own school directly.
 */
export function SchoolPicker({
  schools,
  basePath,
  title,
}: {
  schools: SchoolOption[];
  basePath: string;
  title: string;
}) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      {schools.length === 0 ? (
        <p className="mb-4 text-textsecondary">No schools exist yet.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-textsecondary">Choose a school:</p>
          <ul className="mb-4 space-y-2">
            {schools.map((school) => (
              <li key={school.id}>
                <Link
                  href={`${basePath}?school=${school.id}`}
                  className="block rounded-lg border border-white/10 bg-panel px-4 py-3 hover:border-accent"
                >
                  {school.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/admin/school/new" className="text-sm font-semibold text-accent hover:underline">
        + Create school
      </Link>
    </div>
  );
}

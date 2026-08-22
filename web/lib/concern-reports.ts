import { createSupabaseServerClient } from "./supabase-server";

export type ConcernReportStatus = "new" | "reviewed" | "resolved";

export interface ConcernReport {
  id: string;
  fixtureId: string | null;
  reporterName: string | null;
  reporterEmail: string;
  description: string;
  status: ConcernReportStatus;
  createdAt: string;
}

export async function loadConcernReports(): Promise<ConcernReport[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("concern_reports")
    .select("id, fixture_id, reporter_name, reporter_email, description, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load concern reports: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    fixtureId: row.fixture_id,
    reporterName: row.reporter_name,
    reporterEmail: row.reporter_email,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/**
 * Same cheap head-only-count nav-badge pattern as
 * loadPendingSchoolRequestCount — platform_admin only (admin/layout.tsx),
 * "new" is this table's equivalent of "pending".
 */
export async function loadNewConcernReportCount(): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("concern_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) throw new Error(`Could not load new concern report count: ${error.message}`);
  return count ?? 0;
}

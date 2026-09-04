import type { SubscriptionStatus } from "./subscriptions";
import { createSupabaseServerClient } from "./supabase-server";

// The admin-only "who's actually signed up" overview (/admin/directory) —
// every real school, every school_operator account, and every parent
// account, read straight from the live tables on each request. There's
// nothing to keep in sync: this is a query, not an export, so it's
// current the moment the page loads. Flat queries resolved in JS, same
// reasoning as lib/fixtures.ts/lib/supabase.ts and lib/admin.ts elsewhere
// in this app — no embedded-relation select.

export interface DirectorySchool {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  consentConfirmedAt: string | null;
  createdAt: string;
  subscriptionStatus: SubscriptionStatus | null;
  operatorCount: number;
  followerCount: number;
}

export interface DirectoryOperator {
  id: string;
  email: string | null;
  fullName: string | null;
  schoolId: string | null;
  schoolName: string | null;
  createdAt: string;
}

export interface DirectoryParent {
  id: string;
  email: string | null;
  fullName: string | null;
  favouriteSchoolNames: string[];
  createdAt: string;
}

export interface Directory {
  schools: DirectorySchool[];
  operators: DirectoryOperator[];
  parents: DirectoryParent[];
}

export async function loadDirectory(): Promise<Directory> {
  const supabase = createSupabaseServerClient();

  const [schoolsRes, subscriptionsRes, profilesRes, favouritesRes] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, contact_email, contact_phone, consent_confirmed_at, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("school_id, status"),
    supabase
      .from("profiles")
      .select("id, email, full_name, role, school_id, created_at")
      .in("role", ["school_operator", "parent"])
      .order("created_at", { ascending: false }),
    supabase.from("favourites").select("parent_id, school_id"),
  ]);

  if (schoolsRes.error) throw new Error(`Could not load schools: ${schoolsRes.error.message}`);
  if (subscriptionsRes.error) throw new Error(`Could not load subscriptions: ${subscriptionsRes.error.message}`);
  if (profilesRes.error) throw new Error(`Could not load accounts: ${profilesRes.error.message}`);
  if (favouritesRes.error) throw new Error(`Could not load favourites: ${favouritesRes.error.message}`);

  const schoolRows = schoolsRes.data ?? [];
  const subscriptionRows = subscriptionsRes.data ?? [];
  const profileRows = profilesRes.data ?? [];
  const favouriteRows = favouritesRes.data ?? [];

  const schoolNameById = new Map(schoolRows.map((s) => [s.id, s.name]));
  const subscriptionStatusBySchoolId = new Map(subscriptionRows.map((s) => [s.school_id, s.status as SubscriptionStatus]));

  const operatorRows = profileRows.filter((p) => p.role === "school_operator");
  const parentRows = profileRows.filter((p) => p.role === "parent");

  const operatorCountBySchoolId = new Map<string, number>();
  for (const op of operatorRows) {
    if (!op.school_id) continue;
    operatorCountBySchoolId.set(op.school_id, (operatorCountBySchoolId.get(op.school_id) ?? 0) + 1);
  }

  const followerCountBySchoolId = new Map<string, number>();
  const favouriteSchoolIdsByParentId = new Map<string, string[]>();
  for (const fav of favouriteRows) {
    if (!fav.school_id) continue;
    followerCountBySchoolId.set(fav.school_id, (followerCountBySchoolId.get(fav.school_id) ?? 0) + 1);
    const existing = favouriteSchoolIdsByParentId.get(fav.parent_id) ?? [];
    existing.push(fav.school_id);
    favouriteSchoolIdsByParentId.set(fav.parent_id, existing);
  }

  const schools: DirectorySchool[] = schoolRows.map((s) => ({
    id: s.id,
    name: s.name,
    contactEmail: s.contact_email,
    contactPhone: s.contact_phone,
    consentConfirmedAt: s.consent_confirmed_at,
    createdAt: s.created_at,
    subscriptionStatus: subscriptionStatusBySchoolId.get(s.id) ?? null,
    operatorCount: operatorCountBySchoolId.get(s.id) ?? 0,
    followerCount: followerCountBySchoolId.get(s.id) ?? 0,
  }));

  const operators: DirectoryOperator[] = operatorRows.map((op) => ({
    id: op.id,
    email: op.email,
    fullName: op.full_name,
    schoolId: op.school_id,
    schoolName: op.school_id ? (schoolNameById.get(op.school_id) ?? null) : null,
    createdAt: op.created_at,
  }));

  const parents: DirectoryParent[] = parentRows.map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    favouriteSchoolNames: (favouriteSchoolIdsByParentId.get(p.id) ?? [])
      .map((id) => schoolNameById.get(id))
      .filter((name): name is string => Boolean(name)),
    createdAt: p.created_at,
  }));

  return { schools, operators, parents };
}

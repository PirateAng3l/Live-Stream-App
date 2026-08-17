import type { SubscriptionSummary } from "./subscriptions";
import { createSupabaseServerClient } from "./supabase-server";

/**
 * Null covers two different real cases the caller has to treat the same
 * way either way: RLS hiding the row (not this school, or not staff) and a
 * school that genuinely has no subscriptions row yet (schools are still
 * created by hand — see backend/README.md). Migration 0005's RLS fails
 * open on a missing row (treats it as allowed to create fixtures), so a
 * caller gating UI on this should do the same rather than blocking on
 * `null`.
 */
export async function loadSubscriptionForSchool(schoolId: string): Promise<SubscriptionSummary | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, tier, current_period_end")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw new Error(`Could not load subscription: ${error.message}`);
  if (!data) return null;

  return {
    status: data.status,
    tier: data.tier,
    currentPeriodEnd: data.current_period_end,
  };
}

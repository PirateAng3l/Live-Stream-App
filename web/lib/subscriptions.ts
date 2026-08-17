// Pure types, constants, and display logic — no Supabase import, same split
// as lib/sponsors.ts / lib/sponsors-server.ts. The query lives in
// lib/subscriptions-server.ts.

export const SUBSCRIPTION_STATUSES = ["trial", "active", "expired", "cancelled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "trial":
      return "Trial";
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
  }
}

/**
 * Matches migration 0005's RLS check exactly (fixtures_insert_own_school):
 * trial/active can create fixtures, expired/cancelled can't. Kept as one
 * named function rather than inlining the comparison at each call site so
 * the two places that need it (the create-fixture Server Action's
 * pre-check and the new-fixture page's UI gate) can't drift apart.
 */
export function isSubscriptionOperational(status: SubscriptionStatus): boolean {
  return status === "trial" || status === "active";
}

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  tier: string;
  currentPeriodEnd: string | null;
}

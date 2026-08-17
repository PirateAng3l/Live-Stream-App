import type { SubscriptionStatus } from "@/lib/subscriptions";
import { subscriptionStatusLabel } from "@/lib/subscriptions";

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  trial: "bg-white/10 text-textsecondary",
  active: "bg-ok/20 text-ok",
  expired: "bg-live text-white",
  cancelled: "bg-live text-white",
};

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
      {subscriptionStatusLabel(status)}
    </span>
  );
}

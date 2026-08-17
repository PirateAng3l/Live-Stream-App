import type { FixtureStatus } from "@/lib/fixtures";

export const authInputClass =
  "w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-textprimary placeholder:text-textsecondary focus:border-accent focus:outline-none";

export const authButtonClass =
  "w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50";

const STATUS_STYLES: Record<FixtureStatus, string> = {
  live: "bg-live text-white",
  scheduled: "bg-white/10 text-textsecondary",
  completed: "bg-ok/20 text-ok",
  cancelled: "bg-white/10 text-textsecondary line-through",
};

export function StatusBadge({ status }: { status: FixtureStatus }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function BackendNotConfigured() {
  return (
    <div className="rounded-lg border border-white/10 bg-panel p-6 text-textsecondary">
      <p className="font-semibold text-textprimary">Backend not configured</p>
      <p className="mt-1 text-sm">
        Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env.local — see
        web/README.md.
      </p>
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-live/40 bg-panel p-6 text-textsecondary">
      <p className="font-semibold text-live">Something went wrong loading this</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}

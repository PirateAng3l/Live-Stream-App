import Link from "next/link";

// DRAFT CONTENT — same caveat as app/privacy/page.tsx: not legal advice,
// needs a real review before launch.
export const metadata = { title: "Terms of Use — Open Door Live" };

export default function TermsPage() {
  return (
    <div className="space-y-4 text-sm text-textsecondary">
      <div className="rounded-lg border border-live/40 bg-live/10 p-4 text-live">
        <strong>Draft — not yet reviewed by a lawyer.</strong> Not a final, binding terms document.
      </div>

      <h1 className="text-2xl font-bold text-textprimary">Terms of Use</h1>

      <h2 className="pt-2 text-lg font-semibold text-textprimary">Schools</h2>
      <p>
        By creating a fixture on this platform, a school confirms it holds appropriate parental/guardian
        consent to film and broadcast its students, and is responsible for that consent — Open Door Live
        provides the tools to broadcast and gate viewing, not a substitute for a school&apos;s own
        safeguarding process.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-textprimary">Parents and other viewers</h2>
      <p>
        Match video is provided for the school community to follow their teams. Please don&apos;t share, embed,
        or re-broadcast footage of other people&apos;s children outside this platform. If you have a concern
        about a specific video, use{" "}
        <Link href="/report-concern" className="text-accent">
          Report a concern
        </Link>{" "}
        rather than sharing it further.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-textprimary">Service availability</h2>
      <p>
        This platform is provided as-is. Live streams depend on the crew&apos;s own device, network connection,
        and third-party services (YouTube, Supabase) that are outside our control, and we can&apos;t guarantee
        uninterrupted delivery of any individual broadcast.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-textprimary">Not yet finalized</h2>
      <p>
        Formal liability, termination, and dispute-resolution terms are still pending legal review.
      </p>
    </div>
  );
}

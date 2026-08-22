import Link from "next/link";

// DRAFT CONTENT — see the banner rendered below. This page exists so the
// software has somewhere to point PROJECT_SPEC.md 4.5's "clear data-
// processing position and privacy policy" at, but the actual wording is
// not legal advice and must be reviewed (and very likely revised) by
// someone with real POPIA expertise before this goes live for real
// schools — the spec is explicit that this project must not skip that
// step. Written honestly about what the platform actually does today,
// including its known limitation (spec 4.4: gated viewing, not a fully
// private video).
export const metadata = { title: "Privacy Policy — Open Door Live" };

export default function PrivacyPage() {
  return (
    <div className="space-y-4 text-sm text-textsecondary">
      <div className="rounded-lg border border-live/40 bg-live/10 p-4 text-live">
        <strong>Draft — not yet reviewed by a lawyer.</strong> This page describes, honestly, what Open Door
        Live actually does with your data today. It has not been confirmed as compliant with POPIA or any
        other law, and should not be relied on as a final policy.
      </div>

      <h1 className="text-2xl font-bold text-textprimary">Privacy Policy</h1>

      <h2 className="pt-2 text-lg font-semibold text-textprimary">What we collect</h2>
      <p>
        If you create a parent account: your email address, and any favourites or notify-me subscriptions you
        set up. If you&apos;re a school: your school&apos;s name, contact details, logo, team and sponsor
        information, and the account email addresses of anyone your school invites to operate the platform.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-textprimary">Video of matches</h2>
      <p>
        Schools broadcast footage of their own students during matches. Before a school can create a fixture on
        this platform, it must confirm it holds appropriate parental/guardian consent to film and broadcast its
        students — Open Door Live does not itself collect that consent or verify it directly with parents; that
        is the school&apos;s responsibility.
      </p>
      <p>
        Viewing match footage requires a signed-in account. The underlying video is hosted as an unlisted
        YouTube video, not a fully private one — this platform controls who can reach it through the site, but
        an unlisted link that leaves the site (for example, forwarded by someone who found it) is not something
        we can technically prevent. We are open about this limitation rather than overstating how closed the
        video actually is.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-textprimary">Who else sees this data</h2>
      <p>
        Data is stored with Supabase (database, authentication, file storage). Video is hosted on YouTube
        (Google). Emails are sent via Resend. We don&apos;t sell data to anyone.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-textprimary">Your rights</h2>
      <p>
        You can ask us what data we hold about you, ask us to correct it, or ask us to delete your account.
        If you&apos;re concerned about a specific video — including a request to take down footage of your
        child — use{" "}
        <Link href="/report-concern" className="text-accent">
          Report a concern
        </Link>
        . We haven&apos;t yet published a dedicated contact address for other requests; until we do, the same
        form reaches us.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-textprimary">Not yet finalized</h2>
      <p>
        Formal data retention periods, a registered Information Officer, and a confirmed legal basis for each
        type of processing under POPIA are still pending review. This section will be updated once that review
        is complete.
      </p>
    </div>
  );
}

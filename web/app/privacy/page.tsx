import Link from "next/link";

// This page exists so the software has somewhere to point PROJECT_SPEC.md
// 4.5's "clear data-processing position and privacy policy" at. Written
// honestly about what the platform actually does today, including its
// known limitation: video is gated behind sign-in on this site, but the
// underlying YouTube video is public, not private — spec 4.4 originally
// called for unlisted, later deliberately changed to public for
// channel/sponsor visibility (see backend README). Formal POPIA legal
// review was consciously decided against (see PROJECT_SPEC.md's 4.5
// update note) — the platform's position is that responsibility for a
// child's consent to be filmed sits with the school, per the enforced
// consent-attestation gate described below, not with Open Door Live.
export const metadata = { title: "Privacy Policy — Open Door Live" };

export default function PrivacyPage() {
  return (
    <div className="space-y-4 text-sm text-textsecondary">
      <h1 className="text-2xl font-bold text-textprimary">Privacy Policy</h1>
      <p>
        This policy covers Open Door Live as operated at{" "}
        <a href="https://opendoorlive.co.za" className="text-accent">
          opendoorlive.co.za
        </a>
        .
      </p>

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
        Viewing match footage through Open Door Live requires a signed-in account. The underlying video is
        hosted as a public YouTube video, not a private or unlisted one — it can also be found and watched
        directly on YouTube, through search or by browsing the channel, without ever visiting this site or
        signing in. This platform&apos;s sign-in requirement only controls access through Open Door Live
        itself. Schools have chosen this openly, so that real match coverage is genuinely visible to
        sponsors and prospective schools. Taking a video down through this platform (see &ldquo;Your
        rights&rdquo; below) removes it from Open Door Live but does not, on its own, remove it from YouTube.
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

      <h2 className="pt-2 text-lg font-semibold text-textprimary">Consent responsibility</h2>
      <p>
        Filming and broadcasting students happens at each school&apos;s own direction. Before a school can
        create its first fixture, it must confirm — through the platform itself — that it holds appropriate
        parental/guardian consent to do so. Open Door Live provides and enforces that confirmation gate; the
        underlying consent process, and responsibility for it, is the school&apos;s own.
      </p>
    </div>
  );
}

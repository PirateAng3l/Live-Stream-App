import Link from "next/link";

// A plain-language companion to /privacy and /terms — same underlying facts
// (the consent gate, the login-gated-not-private video, the report-concern
// flow), written for a parent or school reading on their phone rather than
// a lawyer. Not a substitute for either draft policy page; see those for
// the fuller, more formal wording.
export const metadata = { title: "Safety & Consent — Open Door Live" };

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <section className="py-8 sm:py-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Family &amp; school guide
        </p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Safety &amp; consent, plainly explained</h1>
        <p className="mt-4 text-textsecondary">
          How match footage of your child is protected, what your school has already confirmed, and what
          to do if you&apos;re ever concerned.
        </p>
      </section>

      <div className="space-y-12 pb-16">
        <section>
          <p className="text-textsecondary">
            Every match your school streams on Open Door Live involves filming students. We take that
            seriously. This page explains — in plain language, not legal fine print — exactly what
            protections are in place today.
          </p>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">Viewing</p>
          <h2 className="mb-3 text-xl font-bold">Only signed-in families can watch</h2>
          <div className="space-y-4 rounded-lg border border-white/10 bg-panel p-6">
            <p className="text-textsecondary">
              Anyone can see that a match happened — the date, the teams, the final score. But to actually
              watch the footage, a visitor has to sign in with an account first. Nobody can stumble onto a
              match by browsing the site anonymously.
            </p>
            <div className="rounded-lg border border-live/30 bg-live/10 p-4 text-sm text-textprimary">
              Being honest about the limits: the video itself is stored as an &ldquo;unlisted&rdquo; file, not
              a fully private one. Our sign-in wall controls who reaches it <em>through this site</em> — but
              a link that leaves the site some other way (a screenshot, a forward) isn&apos;t something we
              can technically stop. We&apos;d rather tell you that plainly than overstate how locked-down it
              is.
            </div>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">Consent</p>
          <h2 className="mb-3 text-xl font-bold">Your school confirms consent before broadcasting</h2>
          <p className="mb-4 text-textsecondary">
            Before a school can go live with its very first match, someone at that school has to explicitly
            confirm — in writing, inside the platform — that the school holds appropriate consent from
            parents and guardians to film and broadcast students. Until that&apos;s done, the school
            technically cannot create a match at all.
          </p>
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
            <div className="bg-panel p-5">
              <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-textsecondary">
                Who confirms it
              </dt>
              <dd className="text-sm text-textprimary">
                A staff member with admin access at your school, not Open Door Live.
              </dd>
            </div>
            <div className="bg-panel p-5">
              <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-textsecondary">
                What&apos;s recorded
              </dt>
              <dd className="text-sm text-textprimary">
                A timestamp and which account confirmed it — a real, checkable record.
              </dd>
            </div>
            <div className="bg-panel p-5">
              <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-textsecondary">
                If you&apos;re unsure
              </dt>
              <dd className="text-sm text-textprimary">
                Ask your school directly what their consent process looks like for filming.
              </dd>
            </div>
            <div className="bg-panel p-5">
              <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-textsecondary">
                Our role
              </dt>
              <dd className="text-sm text-textprimary">
                We build the checkpoint and enforce it technically; the school owns the process behind it.
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-ok/30 bg-ok/10 p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-ok">If something&apos;s wrong</p>
          <h2 className="mb-3 text-xl font-bold">Ask us to take a video down</h2>
          <p className="mb-4 text-textsecondary">
            If you&apos;re ever concerned about specific footage — including a request to remove a video
            featuring your child — tell us directly. No account needed.
          </p>
          <Link
            href="/report-concern"
            className="inline-flex items-center gap-2 rounded-md bg-ok px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
          >
            Report a concern &rarr;
          </Link>
          <ol className="mt-6 space-y-4 border-t border-white/10 pt-4">
            <li className="grid grid-cols-[24px_1fr] gap-3">
              <span className="text-lg font-bold text-ok">1</span>
              <p className="text-sm text-textsecondary">
                <span className="block font-semibold text-textprimary">You tell us what&apos;s wrong.</span>
                A short form: your email, an optional link to the match, and what&apos;s happening.
              </p>
            </li>
            <li className="grid grid-cols-[24px_1fr] gap-3">
              <span className="text-lg font-bold text-ok">2</span>
              <p className="text-sm text-textsecondary">
                <span className="block font-semibold text-textprimary">We review it.</span>
                Every report reaches a real person who reviews it directly — nothing is auto-closed.
              </p>
            </li>
            <li className="grid grid-cols-[24px_1fr] gap-3">
              <span className="text-lg font-bold text-ok">3</span>
              <p className="text-sm text-textsecondary">
                <span className="block font-semibold text-textprimary">We act.</span>
                A video can be pulled from the site immediately, for every viewer, the moment we decide
                it&apos;s warranted.
              </p>
            </li>
          </ol>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">Common questions</p>
          <h2 className="mb-4 text-xl font-bold">You might be wondering</h2>
          <div className="divide-y divide-white/10 rounded-lg border border-white/10 bg-panel">
            <div className="p-5">
              <p className="mb-1 font-semibold text-textprimary">Can this video show up in a Google search?</p>
              <p className="text-sm text-textsecondary">
                No — it&apos;s not indexed or publicly listed. It only becomes reachable through a direct
                link, and only plays for a signed-in viewer.
              </p>
            </div>
            <div className="p-5">
              <p className="mb-1 font-semibold text-textprimary">How long do you keep the footage?</p>
              <p className="text-sm text-textsecondary">
                We don&apos;t yet have a fixed retention period published — this is one of the things still
                being finalized with legal review. We&apos;ll update this page once it&apos;s settled.
              </p>
            </div>
            <div className="p-5">
              <p className="mb-1 font-semibold text-textprimary">
                Can I ask for just my child to be left out of a stream?
              </p>
              <p className="text-sm text-textsecondary">
                There&apos;s no way to selectively blur or remove one player from a live broadcast today.
                If that&apos;s something you need, speak to your school before match day, or use the report
                link above afterward.
              </p>
            </div>
            <div className="p-5">
              <p className="mb-1 font-semibold text-textprimary">Is this policy finished?</p>
              <p className="text-sm text-textsecondary">
                Not yet, and we&apos;d rather say so than pretend otherwise. Our fuller{" "}
                <Link href="/privacy" className="text-accent">
                  privacy policy
                </Link>{" "}
                is still in draft and pending review by a lawyer with data-protection expertise. This page
                will be updated as that firms up.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

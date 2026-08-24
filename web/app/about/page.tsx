export const metadata = {
  title: "About — Open Door Live",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <section className="py-8 text-center sm:py-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">About us</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">
          Bringing school life to everyone who can&apos;t be there.
        </h1>
      </section>

      <div className="space-y-10 pb-16">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-accent">Why we exist</h2>
          <p className="text-textsecondary">
            Life is busy. Work, other commitments, other kids&apos; schedules — parents and
            grandparents don&apos;t always get to be there when a child plays a match, takes the
            stage in a school play, or performs at a concert. Open Door Live exists to close that
            gap: every game and every school event, streamed live, so the people who matter most
            don&apos;t have to miss it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-accent">One phone. One platform.</h2>
          <p className="text-textsecondary">
            Live streaming is usually expensive and technical — cameras, crews, editing,
            hosting. We built an all-in-one alternative instead: a single phone and one operator
            can run the whole broadcast, with live scores and match updates shown right alongside
            the stream in the same place fans already are. No separate systems, no specialist
            crew, no big budget required.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-accent">Not just match day</h2>
          <p className="text-textsecondary">
            Rugby, netball, hockey, cricket, and tennis fixtures get the full live scoreboard.
            But the same phone and the same platform work just as well for anything else
            happening in front of the school community — matric farewells, cross country,
            chess tournaments, choir performances, opening days, assemblies, prize-giving, even
            a student-led walkthrough of the school for prospective families. Anyone comfortable
            in front of a camera can present it, no scoreboard required.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-accent">Who&apos;s behind it</h2>
          <p className="text-textsecondary">
            Open Door Live is run by a small, hands-on team — and it&apos;s built to stay
            approachable as it grows. The platform is designed so a trained crew member, even a
            student, can be running a confident broadcast after a single day of setup and
            training. That&apos;s deliberate: the fewer specialists a school needs on hand, the
            more matches and events actually get streamed.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-accent">Community first</h2>
          <p className="text-textsecondary">
            This isn&apos;t just about streaming a match — it&apos;s about connection. Open Door
            Live brings students, parents, and the wider community closer to school life, and
            gives local businesses a genuine, reputable platform to support the schools and teams
            they care about.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-accent">Where we&apos;re at</h2>
          <p className="text-textsecondary">
            Open Door Live is part of the Open Door Group — the umbrella under which Open Door
            Productions and future ventures operate. Founded in 2026, with our first live streams
            going out in August 2026.
          </p>
        </section>

        <section className="rounded-lg border border-white/10 bg-panel p-6">
          <h2 className="mb-3 text-lg font-semibold">Get in touch</h2>
          <p className="text-textsecondary">
            <a href="mailto:softleyjd@gmail.com" className="text-accent">
              softleyjd@gmail.com
            </a>
          </p>
          <p className="mt-1 text-textsecondary">
            <a href="tel:0734757971" className="text-accent">
              073 475 7971
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}

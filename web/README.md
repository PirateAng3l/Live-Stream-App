# Open Door Live — Web Platform

The public-facing schedule + replay site (Component C, spec Section 7). Covers
the match schedule, match/replay pages, and login-gated viewing (spec
7.3.1–7.3.3, 4.4). No admin panel yet — see "Not built yet" below.

## What's here

- **`/`** — the schedule ("Live Matches"): Upcoming/Completed tabs, a sport
  filter, one row per fixture linking to its match page. Tabs and the sport
  filter are plain links with query params (`?tab=completed&sport=rugby`),
  not client-side state — works with JS disabled, no hydration to worry about.
  Public — no sign-in needed to browse what matches exist.
- **`/matches/[id]`** — a single fixture: teams, school, kickoff time, final
  score if completed, and (spec 4.4) the actual video is gated: signed-out
  visitors see a "Sign in to watch" prompt instead of the embedded player.
  The same video ID serves both the live stream and the replay once it ends
  (that's how a YouTube Live broadcast works), so there's no "is this live or
  a replay" branch — a signed-in visitor sees the embed whenever the ID
  exists, live or not.
- **`/sign-up`**, **`/sign-in`** — email/password via Supabase Auth. Every
  account created here becomes a `parent`-role profile automatically
  (`handle_new_user` in the backend); there's no path from this site to a
  school_operator or platform_admin account. Handles both possible email-
  confirmation settings on the Supabase project (shows "check your email" if
  confirmation is required, signs straight in if not). A `?redirect=` param
  carries a visitor back to the match they were trying to watch — validated
  against being an absolute URL first (`lib/redirect.ts`), since an
  unchecked redirect target from a query string is a classic open-redirect
  hole.
- Signed-in state shows in the header (email + Sign out) via
  `app/layout.tsx`, which is why every page — even ones that don't
  explicitly gate anything — reads the current session.

**Scope of the gate, deliberately:** only the video itself is behind
sign-in, not the schedule or a match's metadata. The sensitive thing is
watching footage of children, not knowing a fixture happened — keeping
listings public is also what makes the schedule shareable/marketable at
all. This is one reading of spec 4.4/7.3.3 ("Viewing... Access gating"); if
the whole site should be locked down instead, that's a one-line change (gate
in `app/page.tsx` too), not a redesign.

Both pages read fixture/team/school data straight from Supabase using the
**anon key** — safe to do because `fixtures`/`teams`/`schools` are all
publicly readable by design (RLS policies in `backend/supabase/migrations`),
and nothing sensitive (a stream key, say) is ever fetched here. Real access
control for *those* tables is RLS, not keeping the anon key secret; real
access control for *viewing* is the session check in `lib/auth.ts`.

**Honest limit of this gate, same as the spec itself flags:** the YouTube
video behind it is "unlisted," not private — someone who extracts the raw
YouTube URL (view source, browser devtools) could bypass this login wall
entirely and watch directly on YouTube. That's spec 4.4's own documented
tradeoff for v1, not something introduced here.

## Architecture

Same split as the backend edge function and the Android app's networking
layer, on purpose — one consistent pattern across all three tiers of this
project:

- **`lib/fixtures.ts`** — types + pure display logic (joining team/school
  names onto a fixture, grouping into tabs, filtering by sport, date
  formatting). No Supabase import. Fully unit-tested (`lib/fixtures.test.ts`,
  run with `npm test`) without needing a live database.
- **`lib/redirect.ts`** — validates the `?redirect=` query param used by
  sign-in/sign-up, also pure and unit-tested (`lib/redirect.test.ts`).
- **`lib/supabase.ts`** — the fixture/team/school queries. Two flat queries
  (fixtures, then teams/schools by id) rather than a PostgREST
  embedded-relation select, same reasoning as `backend/.../db.ts`: simpler
  typing (a `.select()` call needs to be a literal string, not a variable,
  or supabase-js's type inference falls back to an unusable generic type —
  learned that the hard way building this), and doesn't depend on
  foreign-key constraint names staying stable.
- **`lib/supabase-server.ts`** / **`lib/supabase-browser.ts`** — two
  separate Supabase client factories, both needed because a session lives
  in cookies and Server Components / Client Components read cookies
  differently. `supabase-server.ts` is cookie-aware per request (via
  `next/headers`) and is what every Server Component (including
  `lib/supabase.ts`'s queries and `lib/auth.ts`) uses; `supabase-browser.ts`
  is for the sign-in/sign-up/sign-out Client Components, which need to
  trigger real browser-side auth calls that set those cookies in the first
  place.
- **`lib/auth.ts`** — `getCurrentParent()`: is there a valid session, full
  stop. No `profiles` table lookup — a session on this site already implies
  parent, see above.
- **`middleware.ts`** — refreshes the session cookie on every request.
  Standard Supabase + Next.js requirement: without it, a session nearing
  expiry can go stale mid-visit, since Server Components mostly can't write
  cookies themselves (see the try/catch in `supabase-server.ts`).

## Setup

```
cd web
npm install
cp .env.local.example .env.local   # then fill in your Supabase project's URL + anon key
npm run dev
```

Without `.env.local` configured, both pages render a "Backend not configured"
message instead of crashing (verified: ran the dev server with and without
real env vars, and separately against an unreachable Supabase URL to confirm
the error path renders a friendly message instead of a 500).

```
npm test        # unit tests for lib/fixtures.ts (no live backend needed)
npm run typecheck
npm run build    # full Next.js production build — this actually ran clean
```

## A known dependency tradeoff, not an oversight

`npm audit` flags Next.js 14.2.35 (the version pinned here) against a long
list of advisories. Looking at them: they're about Server Actions, the
Image Optimizer, i18n rewrites, and middleware-driven *redirects/rewrites*
specifically — this app now has a `middleware.ts` (added for session
refresh), but it only reads the session and passes the request through; it
does no redirecting, rewriting, or routing logic, which is the actual
vulnerable pattern in those advisories. None of Server Actions, the Image
Optimizer, or i18n are used either. The one that's genuinely unavoidable on
14.x is a transitive `postcss` version bundled inside Next.js itself. A full
fix means Next 16, which changes `params`/`searchParams` in Server
Components from plain objects to Promises — a real breaking change to every
page here, untested against this codebase. Deferred rather than rushed in;
worth doing before this goes anywhere near real production traffic.

## Not built yet

- **Parent account features beyond sign-in** (spec 7.3.4) — favourites
  (follow a school/team) and notify subscriptions. The backend tables for
  both (`favourites`, `notify_subscriptions`) already exist with RLS
  scoping a parent to their own rows; nothing in this app writes to them
  yet.
- **"Notify me" for upcoming fixtures** (spec 7.3.2) and the countdown-to-kickoff
  display.
- **Web-layer sponsor slots** around the player (spec 7.3.3) — the baked-in
  overlay from the broadcaster app is the only sponsor placement live right
  now.
- **The admin panel** (spec 7.3.6) — fixtures currently only get created via
  a direct SQL insert (or, once it exists, whatever creates them will need
  to also call the provisioning edge function or rely on the database
  trigger, both already built in `backend/`).
- Local timezone display — kickoff times are shown in a fixed UTC format
  (deliberately, to avoid a server/client hydration mismatch); converting to
  the visitor's local time would need a small client component.

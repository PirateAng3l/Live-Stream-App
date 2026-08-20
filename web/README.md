# Open Door Live — Web Platform

Component C (spec Section 7): the public schedule/replay site, login-gated
viewing, and the internal admin panel — all one Next.js app, matching how
the spec itself groups them (7.3.6 is a subsection of Component C, not a
separate product).

## What's here

- **`/`** — the landing page: hero pitch + a preview of the next few upcoming
  fixtures (linking into `/schedule` for the full list). Deliberately fails
  soft if the fixtures query errors — a broken preview shouldn't take out the
  marketing page the way a genuine data problem should on `/schedule` itself.
- **`/schedule`** — the schedule ("Live Matches"): Upcoming/Completed tabs, a
  sport filter, one row per fixture linking to its match page. Tabs and the
  sport filter are plain links with query params (`?tab=completed&sport=rugby`),
  not client-side state — works with JS disabled, no hydration to worry about.
  Public — no sign-in needed to browse what matches exist.
- **`/about`** — static "About Us" page.
- **`/matches/[id]`** — a single fixture: teams, school, kickoff time, final
  score if completed, and (spec 4.4) the actual video is gated: signed-out
  visitors see a "Sign in to watch" prompt instead of the embedded player.
  The same video ID serves both the live stream and the replay once it ends
  (that's how a YouTube Live broadcast works), so there's no "is this live or
  a replay" branch — a signed-in visitor sees the embed whenever the ID
  exists, live or not. Also shows that fixture's `web_overlay`-layer sponsor
  badges (logo if set, else a text pill; clickable if a click-through URL is
  set), absolutely positioned over the video area in the same three slots
  (lower-third/bottom-left/bottom-right) the broadcaster app's baked-in
  overlay uses — see "Web-layer sponsor overlay" below. Shown regardless of
  sign-in state, since the video is what's gated, not the sponsor badges
  sitting on top of its placeholder.
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

## Admin panel (`/admin`)

Gated to `platform_admin` and `school_operator` accounts only — a parent
account (or nobody) hitting `/admin` gets redirected to `/sign-in`.
Unlike the public site, **these accounts don't self-serve sign up**: per
`backend/README.md`, elevating a profile to school_operator or
platform_admin is a deliberate admin action (concierge, today — someone
runs a SQL update after the account exists). This panel is where they
land once they have one.

- **`/admin`** — the fixture list. A `school_operator` sees only their own
  school's fixtures (an actual query filter, not just relying on RLS to
  hide the rest — see `loadFixturesForStaff` in `lib/admin.ts`); a
  `platform_admin` sees every fixture, across every school. Each row shows
  "Ready to stream" or "Provisioning…" based on whether
  `youtube_video_id` has landed yet, and links through to
  `/admin/fixtures/[id]`.
- **`/admin/fixtures/new`** — create a fixture. This is the whole
  "scheduling feature" the spec calls out (7.3.6) — the form does nothing
  but insert a row into `fixtures`; the YouTube broadcast gets provisioned
  automatically from there by the database trigger already built in
  `backend/` (migration 0002). Needs at least two teams to exist for the
  school first.
- **`/admin/fixtures/[id]`** — a single fixture's detail page: kickoff
  time, status, streaming readiness, and its sponsor placements. Shows
  which sponsors are currently assigned (tier, position, and whether the
  placement is baked into the video or web-only), a remove button per
  assignment, and a form to assign another sponsor from that fixture's own
  school. A `school_operator` hitting another school's fixture ID gets a
  404 (`notFound()`), on top of RLS already stopping the read — belt and
  braces, not load-bearing on its own. Also has **Edit fixture** (sport,
  teams, kickoff time — `/admin/fixtures/[id]/edit`) and **Delete fixture**
  (confirm-guarded; cascades `fixture_sponsors` and
  `fixture_broadcast_credentials`, migration 0001 — the YouTube broadcast
  itself isn't torn down via the API, it's just left orphaned/unlisted on
  the channel).
- **`/admin/teams`**, **`/admin/teams/new`**, **`/admin/teams/[id]/edit`** —
  list/create/edit teams for a school. A prerequisite for creating a
  fixture (a fixture needs two existing team IDs), so it had to come first.
  Deleting a team that's still referenced by a fixture (`home_team_id`/
  `away_team_id` have no `ON DELETE` behavior, deliberately — an orphaned
  reference would be a data-integrity mess) fails with a friendly message
  instead of a raw Postgres foreign-key error — `deleteTeamAction` catches
  Postgres error code `23503` specifically.
- **`/admin/sponsors`**, **`/admin/sponsors/new`**, **`/admin/sponsors/[id]/edit`**
  — list/create/edit a school's sponsor inventory (name, tier, default
  position, optional logo and click-through URLs). This is the "who" —
  which sponsors a school has under contract; assigning one of them to a
  specific fixture happens on that fixture's own detail page
  (`/admin/fixtures/[id]`), since the same sponsor can appear on many
  fixtures with different placements each time. Deleting a sponsor cascades
  its `fixture_sponsors` assignments (migration 0001) — nothing blocks it
  the way an in-use team blocks a delete.
- A `platform_admin` has no school of their own, so `/admin/teams`,
  `/admin/sponsors`, and `/admin/fixtures/new` show a school picker first
  (`?school=<id>` in the URL) rather than assuming one. A `school_operator`
  never sees this step —
  `resolveSchoolContext` (`lib/admin.ts`) always resolves straight to their
  own school, and **ignores any school the client tries to submit**, even
  from a tampered hidden form field. That function is the one piece of
  real authorization-adjacent logic in the admin panel, which is why it's
  pure and unit-tested (`lib/admin.test.ts`) on exactly that case, on top
  of RLS backing it up as a second layer either way.
- Writes (`createTeamAction`, `createFixtureAction`, `createSponsorAction`,
  `assignSponsorAction`/`removeSponsorAction` in each section's
  `actions.ts`) are Next.js Server Actions — the App Router's mechanism for
  a form mutation that needs the real signed-in session, wired up with
  `useFormState`/`useFormStatus` so a rejected submission (missing field,
  RLS denial, whatever) shows inline instead of a blank failure. The
  fixture-detail actions re-derive the fixture's host school from the
  `fixtures` table itself (there's no school picker on that page — a
  fixture's school is fixed at creation) rather than trusting anything the
  form submits, same defense-in-depth pattern as `resolveSchoolContext`
  above.

**Known rough edge:** the sign-in redirect after hitting a gated `/admin`
page always lands back on `/admin` itself, not the specific sub-page (e.g.
`/admin/teams/new`) that triggered it — the redirect lives in the shared
`app/admin/layout.tsx`, which doesn't know which page asked for it. Minor;
fixable later with a middleware-injected path header if it's ever annoying
enough to bother with.

## Web-layer sponsor overlay (`/matches/[id]`)

`SponsorOverlay` (`app/matches/[id]/sponsor-overlay.tsx`) renders a
fixture's `web_overlay`-layer sponsors as absolutely-positioned badges over
the video container — the "web-layer sponsor slots" spec 7.3.3 calls out
and the counterpart to the broadcaster app's baked-in overlay (the app
still isn't wired to `fixture_sponsors` at all, so a `baked_in`-layer
assignment made in `/admin` doesn't show up anywhere yet — see the
top-level README). `webOverlaySponsors()` and `groupByPosition()`
(`lib/sponsors.ts`) are the pure logic behind it — filtering to the right
layer and bucketing by slot — and are unit-tested (`lib/sponsors.test.ts`)
the same way `lib/fixtures.ts`'s helpers are.

Loading the sponsor list fails soft: a Supabase error there logs nothing
special and just falls back to an empty overlay rather than `LoadError`-ing
the whole page, since the video is why anyone's on this page — a broken
sponsor fetch shouldn't take that down too.

**Known rough edges:**
- No collision handling — if a school assigns more sponsors to one slot
  than comfortably fit (say five bottom-right badges), they'll just wrap
  and stack awkwardly. Fine for the handful of sponsors a school
  realistically has; would need a cap or carousel at real scale.
- No dark/light contrast tuning beyond a flat `bg-black/60` — assumes a
  reasonably dark video frame behind it, which is usually true for a live
  sports stream but not guaranteed.
- Sponsor logos are rendered as plain `<img>`, not `next/image` (arbitrary
  external URLs `next/image` would need domain-allow-listed ahead of time),
  so there's no automatic resizing/optimization — a school linking a huge
  source image will serve it at full size, just visually constrained by
  CSS.

## Subscription status

Surfaces (and, on the backend, enforces) the business decision already
locked in: subscription status gates *operations*, never viewing past
replays (see `backend/README.md`). "Operations" is now concrete for the
first time — creating a new fixture:

- A `school_operator`'s status badge (Trial/Active/Expired/Cancelled)
  shows in the `/admin` header (`app/admin/layout.tsx`,
  `_subscription-badge.tsx`). A `platform_admin` doesn't get one — they
  have no single school to show a badge for, same reasoning as why they
  get a school picker everywhere else instead of an implicit school.
- `/admin/fixtures/new` checks the resolved school's subscription before
  rendering the create form: expired/cancelled shows an explanatory
  message instead of the form. `createFixtureAction` re-runs the same
  check server-side before inserting (defense in depth, same pattern as
  every other write in this panel) with a friendly error message rather
  than surfacing RLS's raw denial text.
- The real backstop is backend migration `0005_gate_fixture_creation_on_subscription.sql`:
  `fixtures_write_own_school` was one `for all` policy covering
  insert/update/delete together, which would have blocked *updating* an
  existing fixture (e.g. entering a final score) once a subscription
  lapsed — not what was decided. Split into per-command policies so only
  INSERT carries the subscription check; UPDATE/DELETE are unaffected by
  status. Validated locally with real `authenticated`-role impersonation:
  active → insert succeeds, expired → insert rejected, no subscription row
  at all → insert still succeeds (fail-open on a missing row, since
  schools are still created by hand and nothing guarantees a row exists
  the moment one does — see `backend/README.md`), and an update on an
  already-lapsed school's existing fixture still succeeds.
- `lib/subscriptions.ts` (pure: `isSubscriptionOperational()`,
  `subscriptionStatusLabel()`, unit-tested in `lib/subscriptions.test.ts`)
  /  `lib/subscriptions-server.ts` (`loadSubscriptionForSchool`) — same
  pure-logic/I-O split as sponsors and fixtures elsewhere in this app.

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
- **`lib/staff.ts`** — `getCurrentStaffProfile()`: the admin-panel
  counterpart to `getCurrentParent()`. Actually reads `profiles` (role,
  school_id), since staff accounts aren't self-serve and the panel needs to
  know who it's dealing with. Both this and `getCurrentParent()` are
  wrapped in React's `cache()` so a request that reads the session from
  both a layout and a page (normal in this app) only hits Supabase once.
- **`lib/admin.ts`** — the admin panel's data access (`loadAllSchools`,
  `loadTeamsForSchool`, `loadFixturesForStaff`) plus
  `resolveSchoolContext()`, the one pure/testable piece of
  authorization-adjacent logic in the panel (see the Admin panel section
  above).
- **`lib/sponsors.ts`** / **`lib/sponsors-server.ts`** — same pure-logic /
  I/O split as `lib/fixtures.ts` vs `lib/supabase.ts`: `sponsors.ts` holds
  the tier/position/layer constants, types, label functions, and now also
  `webOverlaySponsors()`/`groupByPosition()` (the filtering/bucketing logic
  behind the `/matches/[id]` sponsor overlay) — no Supabase import, so
  Client Component forms and the overlay component can both import it
  directly and it's unit-tested without a live database
  (`lib/sponsors.test.ts`); `sponsors-server.ts` holds `loadSponsorsForSchool`
  and `loadFixtureSponsors`, which do need `next/headers` through
  `supabase-server.ts` and so can only be imported from Server Components.
  Splitting these out wasn't optional — the first version had them in one
  file and `next build` failed the moment a Client Component imported a
  constant from it, since that import graph also pulled in `next/headers`.
- **`lib/subscriptions.ts`** / **`lib/subscriptions-server.ts`** — same
  split again: `subscriptions.ts` holds the status type,
  `isSubscriptionOperational()`, and `subscriptionStatusLabel()` (pure,
  unit-tested in `lib/subscriptions.test.ts` — see "Subscription status"
  above); `subscriptions-server.ts` holds `loadSubscriptionForSchool`.
- **`lib/sports.ts`** — the sport catalog, kept in sync by hand with the
  Android app's `Sport` enum (comment in the file explains why: a
  fixture's `sport` string has to match one of that enum's names for the
  app to auto-select the right scoreboard layout when a crew member loads
  it).
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
- **Re-provisioning on fixture edit** — editing a fixture's kickoff time
  doesn't touch its already-provisioned YouTube broadcast (its
  `scheduledStartTime` on YouTube's side stays whatever it was at creation).
  Fine for now since `enableAutoStart` means the actual go-live moment is
  driven by the app pushing RTMP, not that scheduled time — but worth
  revisiting if that field starts being shown to viewers anywhere. The edge
  function's own README already flags re-provisioning (e.g. after a
  transient provisioning failure) as unbuilt too.
- **No logo file upload for sponsors** — `logo_url` is a plain URL text
  field; a school has to host the image somewhere else first and paste the
  link in. Fine for now, matches the "no file upload" scope call already
  made for `click_url`/`logo_url` when this was built.
- **`baked_in`-layer sponsors still don't render anywhere** — the
  `web_overlay` layer now shows on `/matches/[id]` (see "Web-layer sponsor
  overlay" above), but the broadcaster app's video overlay still isn't
  wired to `fixture_sponsors` at all; its sponsor slots are still local
  image picks made on the device (see the top-level README), independent
  of anything set in `/admin`. Connecting the two means the app fetching
  fixture_sponsors + resolved logo URLs during setup, which it doesn't do.
- **Crew account management** — creating a school_operator account (or
  assigning `fixtures.assigned_operator_id` to a specific one) is still a
  manual/SQL step; there's no "invite a crew member" flow anywhere.
- **No self-serve subscription renewal** — a school_operator now sees their
  status badge and a clear "renew to create fixtures" message once lapsed
  (see "Subscription status" below), but there's no billing/payment flow
  anywhere in this app to actually act on it; renewing is still a
  platform_admin-side SQL update to the `subscriptions` row, same as
  everything else in the "concierge onboarding" model this project is on
  for now.
- Local timezone display — kickoff times are shown in a fixed UTC format
  (deliberately, to avoid a server/client hydration mismatch); converting to
  the visitor's local time would need a small client component.

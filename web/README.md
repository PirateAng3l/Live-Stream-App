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
  The preview is filtered to a signed-in parent's favourite schools too, same
  as `/schedule` below.
- **`/schedule`** — the schedule ("Live Matches"): Upcoming/Completed tabs, a
  sport filter, one row per fixture linking to its match page. Tabs and the
  sport filter are plain links with query params (`?tab=completed&sport=rugby`),
  not client-side state — works with JS disabled, no hydration to worry about.
  Public — no sign-in needed to browse what matches exist. A signed-in parent
  who's picked favourite schools (at sign-up or from `/account`) only sees
  those schools' fixtures here; everyone else — signed-out visitors, a parent
  with no favourites picked, and staff/admins (who have no favourites rows at
  all) — sees the full platform-wide list, unchanged from before this
  feature. `lib/fixtures.ts`'s `filterByFavouriteSchools` is the one place
  that rule lives, applied after `loadFixtures()` and before
  `groupFixturesByTab`; a failure loading favourites falls back to
  unfiltered rather than breaking the page.
- **`/account`** — a signed-in parent's own page: pick which school(s) they
  support via checkboxes (`lib/favourites-server.ts`'s
  `setFavouriteSchoolIds`, which replaces the full set rather than diffing
  it). This is the same picker shown at sign-up, just editable afterwards —
  a parent's kids change schools, or they just want to add one later.
  Signed-out visitors get a "sign in" prompt instead of a redirect, same
  style as the video gate on `/matches/[id]`.
- **`/about`** — static "About Us" page. Includes a "Not just match day"
  section spelling out that Clean Slate/Event isn't only for sport — matric
  farewells, cross country, chess, choir, opening days, assemblies,
  prize-giving, a student-led school walkthrough, anything a school wants
  in front of a camera, not just what has a scoreboard.
- **`/matches/[id]`** — a single fixture: teams, school, kickoff time, final
  score if completed, and (spec 4.4) the actual video is gated: signed-out
  visitors see a "Sign in to watch" prompt instead of a way to watch. A
  signed-in visitor gets a "Watch on YouTube" button that opens the video
  on YouTube's own site — **not an embedded iframe**. That used to be an
  embed, but YouTube's `embeddable` video setting turned out to be a real,
  longstanding gap in the Data API: `videos.update` reports success but the
  flag doesn't actually take effect (confirmed live — a follow-up
  `videos.list` read straight after the update still showed `false`; see
  `provision-fixture-broadcast`'s own README), so an embed just showed
  YouTube's "Playback on other websites has been disabled by the video
  owner" error for every viewer except the channel's own owner. Direct
  YouTube playback worked in every test regardless of account, so this
  links straight there instead of fighting an API limitation with no known
  workaround. Same login gate either way — only a signed-in parent sees the
  button at all. The same video ID serves both the live stream and the
  replay once it ends (that's how a YouTube Live broadcast works), so
  there's no "is this live or a replay" branch — the button's own label
  just says "Watch live on YouTube" vs "Watch on YouTube" depending on
  `fixture.status`. Also shows that fixture's `web_overlay`-layer sponsor
  badges (logo if set, else a text pill; clickable if a click-through URL is
  set), absolutely positioned over that button's placeholder in the same
  four slots (lower-third/bottom-left/bottom-right/top-right) the
  broadcaster app's baked-in overlay uses — see "Web-layer sponsor overlay"
  below. Shown regardless of sign-in state, since the video is what's
  gated, not the sponsor badges sitting on top of its placeholder.
- **`/sign-up`**, **`/sign-in`** — email/password via Supabase Auth.
  `/sign-up` now leads with a Parent/School toggle:
  - **Parent** is the original flow — every account created here becomes a
    `parent`-role profile automatically (`handle_new_user` in the backend);
    there's no path from this form to a school_operator or platform_admin
    account. Handles both possible email-confirmation settings on the
    Supabase project (shows "check your email" if confirmation is
    required, signs straight in if not). Also shows an optional "which
    school(s) do you support" checkbox list (schools fetched server-side in
    `/sign-up/page.tsx`, same `loadAllSchools()` the admin panel uses,
    since `schools` is public-read). What happens to that pick depends on
    which of the two email-confirmation paths above fires: with
    confirmation off, `data.session` exists immediately, so the picked
    schools are written to `favourites` right there via the browser
    client. With confirmation on (the default), there's no session yet —
    `auth.uid()` doesn't exist for the `favourites` RLS policy to check —
    so the pick is stashed in `localStorage`
    (`lib/favourites-pending.ts`) instead. `FavouritesSync`
    (`app/_favourites-sync.tsx`), mounted in the root layout whenever
    `getCurrentParent()` finds a session, picks up any stashed schools on
    the next page load after the parent actually confirms and signs in,
    writes them, and clears storage. A parent can always add or change
    schools later from `/account` regardless of which path they went
    through.
  - **School** doesn't create an account or session at all — it's a public
    insert into `school_signup_requests` (migration 0007: school name,
    contact name/email/phone, optional notes) for platform_admin to review
    at `/admin/school-requests`. This is deliberate: a school "signing up"
    shouldn't hand out real access on its own, just queue a request — see
    "School requests" below.

  `/sign-in` still only ever signs into an account that already exists,
  parent or staff alike. A `?redirect=` param carries a visitor back to the
  match they were trying to watch — validated against being an absolute
  URL first (`lib/redirect.ts`), since an unchecked redirect target from a
  query string is a classic open-redirect hole.
- **`/report-concern`** — spec 4.5's public takedown/opt-out intake form,
  no sign-in required. See "Broadcast consent" and `/admin/concern-reports`
  below for the full flow.
- **`/privacy`, `/terms`** — draft policy pages, explicitly marked as such.
  See below for why.
- Signed-in state shows in the header (email + Sign out) via
  `app/layout.tsx`, which is why every page — even ones that don't
  explicitly gate anything — reads the current session. A small footer
  (also `app/layout.tsx`) links `/privacy`, `/terms`, and `/report-concern`
  from every page.

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

**Honest limit of this gate:** the YouTube video behind it is now fully
**public**, not private or unlisted — deliberately, a later reversal of
spec 4.4's original "unlisted" v1 recommendation, made for channel growth
and sponsor/school visibility (see `PROJECT_SPEC.md`'s 4.4 update note).
Anyone can find and watch the footage directly on YouTube — through
search, browsing the channel, or a shared link — without ever visiting
this site or signing in. This login wall only ever controlled access
*through this site*; that was true even back when the video was merely
unlisted (a link could always be extracted and shared), and is simply
more visible now that the video doesn't need a link to be found at all.

## Admin panel (`/admin`)

Gated to `platform_admin` and `school_operator` accounts only — a parent
account (or nobody) hitting `/admin` gets redirected to `/sign-in`.
Unlike the public site, **these accounts don't self-serve sign up**: per
`backend/README.md`, elevating a profile to school_operator or
platform_admin is a deliberate admin action (concierge, today — someone
runs a SQL update after the account exists). A school choosing "School" on
`/sign-up` doesn't change that — it queues a request, not an account (see
above and "School requests" below). This panel is where they land once
they have one.

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
  itself isn't torn down via the API, it's just left orphaned on the
  channel — still fully public and findable there, since videos are
  public rather than unlisted now). Also has **Take down video** / **Make
  video visible again** (`VisibilityToggleForm`, confirm-guarded) — spec
  4.5's takedown/opt-out lever, flipping `fixtures.hidden_from_viewers`
  (migration 0012). `/matches/[id]` checks that flag ahead of sign-in
  state entirely: a taken-down fixture shows "This video has been taken
  down" for everyone, full stop. This does not touch the underlying
  YouTube video (now public, per `PROJECT_SPEC.md`'s 4.4 update note) — it
  only stops this platform itself from serving it. That gap matters more
  than it used to: with an unlisted video, someone needed the raw link to
  bypass a takedown; with a public one, anyone can already be watching
  independent of this site entirely, takedown or not.
  **Match result** (`CompleteFixtureForm`) is the other manual lever this
  page needed: nothing anywhere — not the Android app, not any backend
  trigger — ever set `status='completed'` or wrote a final score, so a
  finished match just sat under "Upcoming" forever with no score, which is
  what showed up in testing. Marking it completed here (home/away score
  for a scored sport, or just the status for a Clean Slate/Event fixture,
  which has no scoreboard to record) is what moves it to `/schedule`'s
  Completed tab (`groupFixturesByTab`, `lib/fixtures.ts`, already keyed off
  `status`) and surfaces the final score on `/schedule` and `/matches/[id]`
  (both already rendered `finalHomeScore`/`finalAwayScore` when present —
  that display logic was never the gap, nothing was ever writing the data
  it reads). Deliberately a manual concierge action rather than an
  automatic one: a dropped stream isn't the same as a final whistle, so
  guessing "stream ended" as "match finished" would be wrong as often as
  it's right. Re-submittable if a score needs correcting after the fact.
- **`/admin/concern-reports`** — spec 4.5's takedown/opt-out intake queue,
  `platform_admin` only (a report's `fixture_id` is optional, so there's
  no reliable way to scope one to a `school_operator`'s own school).
  Reports arrive from the public `/report-concern` form (no sign-in
  required — a concerned parent may not have an account) — reporter
  name/email, a free-text description, and an optional `fixture_id`
  pre-filled when reached via a match page's own "Report a concern" link.
  `ConcernReportRow`'s **Mark reviewed**/**Mark resolved** just updates the
  report's own status; it deliberately doesn't also flip
  `hidden_from_viewers` — reviewing a report and deciding to actually take
  a video down are different actions, and conflating them would mean
  "this was a false alarm" and "we're taking it down" look the same in the
  audit trail. Jump to the referenced fixture's own detail page (its
  **Take down video** button, above) to actually act on one. Same public-
  insert/admin-manage RLS shape as `school_signup_requests` (migration
  0007) — `concern_reports_insert_public`/`concern_reports_admin_manage`,
  migration 0013.
- **`/privacy`, `/terms`** — draft, explicitly-labeled-as-such pages
  (a red "not yet reviewed by a lawyer" banner on both) giving spec 4.5's
  "clear data-processing position and privacy policy" somewhere to live.
  Written honestly about what the platform actually does today, including
  the spec 4.4 access-control limitation (gated, not cryptographically
  closed) — not legal advice, and not a substitute for the POPIA-expertise
  review the spec calls for before real schools go live. Linked from a
  small footer on every page (`app/layout.tsx`), alongside
  `/report-concern`.
- **`/safety`** — "Safety & Consent," a plain-language companion to
  `/privacy`/`/terms` aimed at a parent or school reading on their phone
  rather than a lawyer: the same underlying facts (login-gated-not-private
  viewing, the school consent gate, how to report a concern), without the
  policy-document tone. Cross-linked from `/privacy`'s banner and from the
  same site-wide footer as the pages above.
- **`/admin/teams`**, **`/admin/teams/new`**, **`/admin/teams/[id]/edit`** —
  list/create/edit teams for a school. A prerequisite for creating a
  fixture (a fixture needs two existing team IDs), so it had to come first.
  Deleting a team that's still referenced by a fixture (`home_team_id`/
  `away_team_id` have no `ON DELETE` behavior, deliberately — an orphaned
  reference would be a data-integrity mess) fails with a friendly message
  instead of a raw Postgres foreign-key error — `deleteTeamAction` catches
  Postgres error code `23503` specifically. A team also has an optional
  `short_name` (migration 0008) — a school's own preferred scoreboard
  abbreviation, e.g. "Rev High 1st Team" for "Revelation High 1st Team".
  The Android crew app prefers it over the full name when it's set
  (`SupabaseClient.getUpcomingFixtures`/`getAllUpcomingFixtures`), falling
  back to `name` when it isn't — on top of, not instead of,
  `TeamOverlayRenderer`'s own auto-shrink/ellipsis, which still handles
  whatever name actually ends up on screen, short or full.
- **`/admin/sponsors`**, **`/admin/sponsors/new`**, **`/admin/sponsors/[id]/edit`**
  — list/create/edit a school's sponsor inventory (name, tier, default
  position, optional click-through URL, logo). This is the "who" — which
  sponsors a school has under contract; assigning one of them to a specific
  fixture happens on that fixture's own detail page (`/admin/fixtures/[id]`),
  since the same sponsor can appear on many fixtures with different
  placements each time. Deleting a sponsor cascades its `fixture_sponsors`
  assignments (migration 0001) — nothing blocks it the way an in-use team
  blocks a delete. `/admin/sponsors/new` is text fields only (same reasoning
  as `/admin/school/new`: a sponsor needs to exist before there's an id to
  upload a logo against) and redirects straight into the new sponsor's edit
  page, same as creating a school does. Logo upload
  (`SponsorLogoForm`/`updateSponsorLogoAction`, `/admin/sponsors/[id]/edit`)
  is its own separate form/action from `EditSponsorForm`/`updateSponsorAction`
  — same split as the school logo below, so saving an unrelated field (say,
  the click-through URL) never wipes out an already-uploaded logo. Goes to
  a public Storage bucket (`sponsor-logos`, migration 0009) at a fixed path
  (`<school_id>/<sponsor_id>.<ext>`, upsert, cache-busted `?v=` — all the
  same reasoning as the school logo upload immediately below), and from
  there into `sponsors.logo_url`, the same plain text column
  `sponsor-overlay.tsx` (web `web_overlay` layer) and now the Android app
  (`baked_in` layer — see the top-level README's crew sign-in section) both
  read.
- **`/admin/school`** — upload the school's own logo (PNG/JPEG/WebP, up to
  5MB). Goes to a public Supabase Storage bucket (`school-logos`, migration
  0006), always at a fixed path (`<school_id>/logo.<ext>`, upsert) so
  re-uploading just replaces it instead of accumulating old files; the
  resulting public URL (cache-busted with `?v=<timestamp>` so a replaced
  logo shows immediately instead of a stale cached copy under the same URL)
  gets written to `schools.logo_url` — a plain text column that's existed
  since migration 0001 but had no UI pointed at it until now. Storage RLS
  scopes uploads the same way every other "own school" write in this
  project does (`current_school_id()`/`is_platform_admin()`), so
  `updateSchoolLogoAction` re-deriving `schoolId` via `resolveSchoolContext`
  rather than trusting the form is defense-in-depth, not the real
  boundary. Read by the Android app to composite into the live overlay's
  home-team logo slot — see the top-level README's crew sign-in section.
- **Broadcast consent** — `/admin/school`'s `ConsentForm`, above the logo
  upload. Spec 4.5 (`PROJECT_SPEC.md`, POPIA & child-safeguarding): "the
  software must support consent flags per school/team." This is that flag
  — a required, timestamped attestation (`schools.consent_confirmed_at`/
  `consent_confirmed_by`, migration 0011) that a school holds appropriate
  parental/guardian consent to film and broadcast its students, gating
  `/admin/fixtures/new` (both the page and `createFixtureAction`
  friendly-error-check it, `fixtures_insert_own_school` RLS is the real
  backstop) until it's on file. Deliberately a factual attestation, not an
  explanation of what adequate consent looks like — this software can't
  determine that; per the spec, POPIA expertise needs to be engaged
  separately before real schools go live, this just makes "did the school
  say yes" a real, enforced gate instead of an assumption. Fails closed:
  every school that existed before this migration needs to confirm too,
  there's no grandfathering.
- **`/admin/school/new`** — creates a `schools` row (name, optional contact
  email/phone) so onboarding a school no longer means a raw SQL insert.
  `platform_admin` only (`createSchoolAction` checks the role; RLS's
  `schools_write_admin`, migration 0001, is the real backstop) — a
  `school_operator` already has exactly one school and never sees the "+
  Create school" link this hangs off of, at the bottom of the school picker
  every platform_admin-facing page already shows. Lands on `/admin/school`
  for the new school right after, since giving it a logo — or inviting its
  first operator (see below) — is the natural next step.
- **`/admin/school-requests`** — the review queue for the "School" option
  on `/sign-up`: pending requests (school name, contact name/email/phone,
  optional notes) with Approve/Reject actions, plus a read-only history of
  already-reviewed ones below. `platform_admin` only, same as
  `/admin/school/new` (role-checked in `actions.ts`;
  `school_signup_requests_admin_manage`, migration 0007, is the real
  backstop). Approving a request runs the exact same insert
  `createSchoolAction` does — same fields, same `schools` row — then marks
  the request `approved` and links it via `resulting_school_id`; rejecting
  just flips its status. An approved row's "Invite operator" link jumps
  straight to `/admin/school`'s invite form (below), prefilled with the
  request's contact email. The admin nav shows a `Requests (N)` count next
  to the link whenever `N` pending requests exist, computed once in
  `admin/layout.tsx` (`loadPendingSchoolRequestCount`) and skipped entirely
  for a `school_operator`, who never sees the link at all.
- **Inviting an operator** — `/admin/school`'s `OperatorInviteForm`
  (`platform_admin` only), below the logo upload. There's only one kind of
  operator account in this project: the same login this creates works both
  here and as the broadcaster app's CREW SIGN-IN (see the top-level
  README) — "school operator" and "crew member" aren't two different
  things. Split across a privilege boundary: the new `invite-school-operator`
  edge function (`backend/supabase/functions/`) does the one thing that
  genuinely needs the service-role key — creating the `auth.users` account
  via `inviteUserByEmail` — using this admin's own session token, not a
  secret this app holds; `inviteOperatorAction` then elevates that new
  profile to `school_operator` with the right `school_id` using this
  admin's *ordinary* session, since `profiles_admin_all` (migration 0001)
  already lets a platform_admin update any profile — no reason to
  duplicate that check inside the edge function too. If the elevation
  write fails after the invite succeeds, the new account just sits at the
  default `role='parent'` until retried, not a broken state. Right below
  it, `ResendInviteForm`/`resendOperatorInviteAction` handles a lost or
  expired invite link — plain `supabase.auth.resetPasswordForEmail`, no
  edge function or service-role key involved, since resending doesn't
  create anything new.
- **`/set-password`** — where both the invite and resend emails land.
  There is no dashboard "Flow type" toggle to set for this (an earlier
  version of this doc claimed one under Authentication → Sign In /
  Providers → Email — it doesn't exist; caught by testing against the
  actual dashboard UI). `@supabase/ssr`'s `createBrowserClient` hard-codes
  `flowType: 'pkce'` unconditionally — that's a library default, not a
  per-project setting, and it can't be turned off from the dashboard.
  PKCE's default link (`{{ .ConfirmationURL }}`, a `?code=...` query
  param) needs a matching "code verifier" stored in the browser that
  started the auth flow — but for an admin-triggered invite/reset email
  there is no such browser; the recipient never started anything, the
  admin did, server-side. That's a structural mismatch, not a timing
  issue: every PKCE attempt failed instantly, regardless of device or how
  quickly the link was clicked. The fix is Supabase's own documented
  pattern for exactly this case: the **Invite user** and **Reset
  Password** email templates (Authentication → Emails → Templates, in the
  Supabase dashboard) must be edited so their link uses
  `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite` (Invite
  user template) or `&type=recovery` (Reset Password template) instead of
  the default `{{ .ConfirmationURL }}`. `SetPasswordForm` reads
  `token_hash`/`type` off the URL with `useSearchParams()` (wrapped in
  `<Suspense>`, same pattern as `/sign-in`'s and `/sign-up`'s own
  `?redirect=` handling) and calls
  `supabase.auth.verifyOtp({ type, token_hash })` on mount — that
  validates the raw token directly against Supabase with no code-verifier
  requirement, which is what actually works for a link nobody but the
  admin ever "started". One client instance for the component's whole
  lifetime (`useState`'s lazy initializer, not created fresh in
  `handleSubmit`) so the same instance that verified the token is the one
  used to update the password afterward; `ready` gates the submit button
  until `verifyOtp` resolves. Once ready, it calls
  `supabase.auth.updateUser({ password })` and sends them to `/admin`.
  `setPasswordRedirectUrl()` (`admin/school/actions.ts`) builds this
  page's base URL from the *incoming request's own* `Host` header rather
  than a hardcoded env var (this becomes `{{ .RedirectTo }}` in the email
  templates above), so it's correct on every Vercel preview URL and the
  production domain alike. **Also requires a one-time dashboard step**:
  this exact URL (e.g. `https://<your-domain>/set-password`) has to be
  added to Supabase's **Authentication → URL Configuration → Redirect
  URLs** allow-list, or Supabase silently ignores `redirectTo` and falls
  back to the Site URL instead — landing back on the marketing homepage,
  the original version of this bug.
- A `platform_admin` has no school of their own, so `/admin/teams`,
  `/admin/sponsors`, `/admin/school`, and `/admin/fixtures/new` show a
  school picker first (`?school=<id>` in the URL) rather than assuming one.
  A `school_operator` never sees this step —
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
and the counterpart to the broadcaster app's baked-in overlay (the Android
app reads its own `baked_in`-layer assignments directly from Supabase now —
see the top-level README's crew sign-in section). `webOverlaySponsors()`
and `groupByPosition()`
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

## Live deployment

Production is served from the custom domain **opendoorlive.co.za**
(purchased separately, routed through Vercel), not the project's default
`*.vercel.app` URL — both the bare apex and `www.opendoorlive.co.za`
resolve and serve the site, since Vercel's own default behavior for an
apex domain is a redirect to `www`.

That apex→`www` redirect matters beyond cosmetics: it means the host a
request actually arrives on is `www.opendoorlive.co.za`, not the apex,
which is what `setPasswordRedirectUrl()` (see `/set-password` above)
builds the invite/reset-password link's `redirectTo` from. Supabase's
**Authentication → URL Configuration → Redirect URLs** allow-list needs
an *exact* string match, so both
`https://opendoorlive.co.za/set-password` and
`https://www.opendoorlive.co.za/set-password` need to be listed — missing
the `www` variant is what silently broke the invite/reset flow the first
time this domain went live (Supabase falls back to Site URL rather than
erroring, so the symptom was a link that landed on the homepage instead
of a clear failure). Site URL itself should be the bare apex.

If the domain ever moves or a second one is added, the DNS records
(A/CNAME at the registrar), the Vercel domain settings, and this Supabase
Redirect URLs list all have to be updated together — missing any one of
the three reproduces the same symptom.

## Compliance reference documents (outside this repo)

Two documents support spec 4.5's POPIA/child-safeguarding work as plain
deliverables, not something checked into this codebase or served by the
app (the parent/school-facing explainer covering the same ground now lives
in-app instead, at `/safety` — see above):

- **POPIA & Child Safeguarding — Summary for Legal Review** (Word doc) — a
  factual technical summary for a lawyer: what personal data is collected,
  how video of minors is handled today, and the specific open questions
  (is the consent-attestation model adequate, what retention period should
  apply, should takedown reach the underlying YouTube video) that need
  expert sign-off before any real school goes live.
- **Safeguarding & Consent — Internal Reference** (Word doc) — a
  status-at-a-glance table of what's built vs. outstanding, plus
  step-by-step instructions for confirming a school's consent and for
  handling a takedown or concern report, for whoever's actually running
  the platform day to day.

Neither is a compliance determination on their own — same caveat as the
draft `/privacy`/`/terms` pages and the "Broadcast consent" section above.

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

- **Team-level favourites and notify subscriptions** (spec 7.3.4) —
  `favourites.team_id` and the whole `notify_subscriptions` table still
  have nothing writing to them. School-level favourites are built (see
  `/account` below); following an individual team, and "notify me" email
  subscriptions, are not.
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
- **Crew account management, partially.** Inviting a school_operator now
  has a real flow (`/admin/school`'s "Invite an operator", see the admin
  panel section above), and a lost/expired invite can be recovered without
  going back through the edge function at all — `/admin/school`'s "Lost an
  invite, or can't sign in?" resend box calls
  `supabase.auth.resetPasswordForEmail` directly (`resendOperatorInviteAction`),
  which works for any existing account regardless of whether the original
  invite was ever confirmed, and doesn't need the service-role key the way
  creating the account did. Still missing: no list of pending-vs-accepted
  invites anywhere, and no way for a school_operator to invite a colleague
  at their own school (platform_admin only, for now). Assigning
  `fixtures.assigned_operator_id` to a specific operator is also still a
  manual/SQL step.
- **No self-serve subscription renewal** — a school_operator now sees their
  status badge and a clear "renew to create fixtures" message once lapsed
  (see "Subscription status" below), but there's no billing/payment flow
  anywhere in this app to actually act on it; renewing is still a
  platform_admin-side SQL update to the `subscriptions` row, same as
  everything else in the "concierge onboarding" model this project is on
  for now.
- **Takedown doesn't reach YouTube itself — deliberately, not a gap to
  close.** "Take down video" (above) stops this platform serving a
  fixture's video; the underlying YouTube video, now public rather than
  merely unlisted, is untouched and stays fully findable there regardless.
  Raised with the school owner once the public-privacy switch made this
  matter more (a taken-down video used to still need its raw unlisted
  link to bypass a takedown; now anyone can already be watching
  independent of this site, takedown or not) — and kept manual on
  purpose. A takedown request serious enough to need one should trigger a
  real internal "why was this asked for" review before the YouTube
  video's own visibility changes, not a silent API call nobody had to
  look at first. Making the YouTube video itself private is a manual
  YouTube Studio step (using the fixture's `youtube_video_id`) for
  whoever runs that review — not something to automate away.
- **POPIA compliance itself is not something this software can claim.**
  Consent attestation, the takedown intake, and these draft policy pages
  are the *support* spec 4.5 asked for — real POPIA/child-safeguarding
  legal review, before any real school's students are filmed, is still
  outstanding and has to happen outside this codebase.
- Local timezone display — kickoff times are shown in a fixed UTC format
  (deliberately, to avoid a server/client hydration mismatch); converting to
  the visitor's local time would need a small client component.

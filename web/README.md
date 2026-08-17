# Open Door Live — Web Platform

The public-facing schedule + replay site (Component C, spec Section 7). First
slice: the match schedule and match/replay pages (spec 7.3.1–7.3.3). No parent
accounts, no login-gating, no admin panel yet — see "Not built yet" below.

## What's here

- **`/`** — the schedule ("Live Matches"): Upcoming/Completed tabs, a sport
  filter, one row per fixture linking to its match page. Tabs and the sport
  filter are plain links with query params (`?tab=completed&sport=rugby`),
  not client-side state — works with JS disabled, no hydration to worry about.
- **`/matches/[id]`** — a single fixture: teams, school, kickoff time, and an
  embedded YouTube player once `fixtures.youtube_video_id` is set. The same
  video ID serves both the live stream and the replay once it ends (that's
  how a YouTube Live broadcast works), so there's no separate "is this live
  or a replay" branch — if the ID exists, embed it.

Both pages read straight from Supabase using the **anon key** — safe to do
because `fixtures`/`teams`/`schools` are all publicly readable by design (RLS
policies in `backend/supabase/migrations`), and nothing sensitive (a stream
key, say) is ever fetched here. Real access control is those RLS policies,
not keeping the anon key secret.

## Architecture

Same split as the backend edge function and the Android app's networking
layer, on purpose — one consistent pattern across all three tiers of this
project:

- **`lib/fixtures.ts`** — types + pure display logic (joining team/school
  names onto a fixture, grouping into tabs, filtering by sport, date
  formatting). No Supabase import. Fully unit-tested (`lib/fixtures.test.ts`,
  run with `npm test`) without needing a live database.
- **`lib/supabase.ts`** — the actual Supabase queries. Two flat queries
  (fixtures, then teams/schools by id) rather than a PostgREST
  embedded-relation select, same reasoning as `backend/.../db.ts`: simpler
  typing (a `.select()` call needs to be a literal string, not a variable,
  or supabase-js's type inference falls back to an unusable generic type —
  learned that the hard way building this), and doesn't depend on
  foreign-key constraint names staying stable.

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
list of advisories. Looking at them: they're about Server Actions,
Middleware, the Image Optimizer, and i18n rewrites — none of which this app
uses (no `middleware.ts`, no Server Actions, no `next/image` remote patterns
configured, no i18n). The one that's or genuinely unavoidable on 14.x is a
transitive `postcss` version bundled inside Next.js itself. A full fix means
Next 16, which changes `params`/`searchParams` in Server Components from
plain objects to Promises — a real breaking change to every page here,
untested against this codebase. Deferred rather than rushed in; worth doing
before this goes anywhere near real production traffic.

## Not built yet

- **Login-gating (spec 4.4).** Right now anyone with a match URL can view
  it — no parent accounts, no auth wall. The spec's v1 recommendation is
  "unlisted YouTube + login-gated web platform," and only the "unlisted"
  half exists (that's set when the broadcast is provisioned, not something
  this web app controls). Parent accounts (spec 7.3.4) don't exist yet.
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

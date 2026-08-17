# provision-fixture-broadcast

Edge function that turns a fixture into an actual YouTube Live broadcast:
looks up which YouTube account the fixture's host school should provision
under, refreshes that account's access token, creates the broadcast
(`liveBroadcasts.insert`), creates a fresh ingest point
(`liveStreams.insert`), binds them together, and saves the results back
onto the fixture.

## Files

- **`youtube.ts`** — typed wrappers around the raw Google API calls. Takes
  `fetch` as a parameter instead of calling it globally, so it can be
  tested without a real network call.
- **`provision.ts`** — orchestrates the full flow. Takes its database access
  as an injected `ProvisionDb` interface instead of importing a Supabase
  client directly, so it can be tested without a live project.
- **`db.ts`** — the real `ProvisionDb`, backed by `@supabase/supabase-js`.
  Only this file (plus `index.ts`) ever touches a live database.
- **`index.ts`** — the actual Deno entrypoint deployed to Supabase. Thin on
  purpose: parses the request, checks the caller is allowed to provision
  *this* fixture (platform admin, or the school_operator belonging to its
  host school), then calls `provision.ts`. Runs with the service-role key
  since it needs the YouTube refresh token and has to write the stream key
  — both locked out of every normal role by RLS — so this function is what
  enforces authorization instead of the database.
- **`youtube.test.ts`**, **`provision.test.ts`** — unit tests covering both
  files above with fake `fetch`/`ProvisionDb`, run with `deno test`.

## Design decisions worth knowing

- **Privacy is hardcoded to `unlisted`.** Matches the viewing-access
  decision (spec 4.4) — not meant to be publicly searchable on YouTube.
- **`enableAutoStart`/`enableAutoStop` are always on**, so the broadcast
  goes live/ends automatically when the app starts/stops pushing RTMP,
  rather than needing a separate "go live" API call.
- **A fresh `liveStream` (and stream key) is created for every fixture,
  never reused.** Two fixtures streaming at the same time must never share
  a stream key — see the concurrency note in `backend/README.md`. Always
  creating a new one makes that true by construction instead of something
  that has to be tracked and enforced elsewhere. The cost is one extra
  quota-consuming API call per fixture, which is the right tradeoff for
  correctness at this scale.

## Running the tests

```
cd backend/supabase/functions/provision-fixture-broadcast
deno test --allow-env youtube.test.ts provision.test.ts
deno check *.ts
deno lint *.ts
deno fmt --check *.ts
```

All of the above pass as of this writing. No live Supabase project or
Google credentials are needed to run them — everything network-facing is
faked in the tests.

## Deploying (not done yet)

Once a real Supabase project is linked (see `backend/README.md`):

```
supabase functions deploy provision-fixture-broadcast
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically
by the Supabase runtime — no need to set those yourself.

You'll also need at least one row in `youtube_accounts` with
`owner_type = 'platform'` before this can provision anything (see
`backend/README.md` for how the refresh token gets there — that's the
concierge OAuth step, still a manual one-time setup, not automated yet).

## Not built yet

- Nothing calls this function automatically when a fixture is created —
  that wiring (an admin panel "create fixture" action, or a database
  trigger/webhook) doesn't exist yet.
- No handling for re-provisioning (e.g. a fixture's scheduled time
  changes) or for tearing down a broadcast if a fixture is cancelled.
- No retry/backoff around the Google API calls — a transient failure
  partway through (e.g. broadcast created but bind fails) currently just
  errors out rather than cleaning up or resuming.

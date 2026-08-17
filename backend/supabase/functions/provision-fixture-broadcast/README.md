# provision-fixture-broadcast

Edge function that turns a fixture into an actual YouTube Live broadcast:
looks up which YouTube account the fixture's host school should provision
under, refreshes that account's access token, creates the broadcast
(`liveBroadcasts.insert`), creates a fresh ingest point
(`liveStreams.insert`), binds them together, and saves the results back
onto the fixture.

## How it gets called

Automatically: `backend/supabase/migrations/0002_provision_on_fixture_insert.sql`
adds a trigger on `fixtures` that fires this function (via `pg_net`, fire-and-forget)
immediately after any fixture is inserted — regardless of what created it (an admin
panel, a future API, a one-off SQL insert). It calls with the project's service-role
key rather than a human session, since a database trigger has no user to act as.

It can also be called directly (e.g. to retry after a failure) by a platform admin
or the school_operator who belongs to the fixture's host school, using their own
session token as normal.

## Files

- **`youtube.ts`** — typed wrappers around the raw Google API calls. Takes
  `fetch` as a parameter instead of calling it globally, so it can be
  tested without a real network call.
- **`provision.ts`** — orchestrates the full flow. Takes its database access
  as an injected `ProvisionDb` interface instead of importing a Supabase
  client directly, so it can be tested without a live project.
- **`authorize.ts`** — decides who's allowed to trigger provisioning for a
  given fixture: the database trigger (via its service-role credential,
  trusted unconditionally — see the comment in the file for why that's
  safe), a platform admin, or the fixture's own school_operator.
- **`db.ts`** — the real `ProvisionDb`, backed by `@supabase/supabase-js`.
  Only this file (plus `index.ts`) ever touches a live database.
- **`index.ts`** — the actual Deno entrypoint deployed to Supabase. Thin on
  purpose: parses the request, decides who's calling, defers the actual
  authorization decision to `authorize.ts`, then calls `provision.ts`.
  Runs with the service-role key since it needs the YouTube refresh token
  and has to write the stream key — both locked out of every normal role
  by RLS.
- **`*.test.ts`** — unit tests for everything above, using fake
  `fetch`/`ProvisionDb`/JWTs, run with `deno test`.

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
deno test --allow-env *.test.ts
deno check *.ts
deno lint *.ts
deno fmt --check *.ts
```

All of the above pass as of this writing. No live Supabase project or
Google credentials are needed to run them — everything network-facing is
faked in the tests. The trigger in `0002_provision_on_fixture_insert.sql`
was separately validated against a local Postgres instance with `pg_net`
and Vault stubbed out — see that migration file's header comment.

## Deploying (not done yet)

Once a real Supabase project is linked (see `backend/README.md`):

```
supabase functions deploy provision-fixture-broadcast
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=...
supabase db push
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically
by the Supabase runtime — no need to set those yourself.

Two more things need to exist before a fixture insert will actually
provision anything:

1. At least one row in `youtube_accounts` with `owner_type = 'platform'`
   (see `backend/README.md` for how the refresh token gets there — the
   concierge OAuth step, still a manual one-time setup, not automated yet).
2. The trigger's own Vault secrets — the function's URL and the
   service-role key it calls with:
   ```sql
   select vault.create_secret(
     'https://<your-project-ref>.supabase.co/functions/v1/provision-fixture-broadcast',
     'provision_fixture_broadcast_url'
   );
   select vault.create_secret('<your service_role key>', 'service_role_key');
   ```
   Until both exist, fixture inserts still succeed — the trigger just logs
   a warning and skips provisioning rather than failing the insert.

## Not built yet

- No handling for re-provisioning (e.g. a fixture's scheduled time
  changes) or for tearing down a broadcast if a fixture is cancelled.
- No retry/backoff around the Google API calls — a transient failure
  partway through (e.g. broadcast created but bind fails) currently just
  errors out rather than cleaning up or resuming. Since the trigger is
  fire-and-forget, that failure is currently only visible in the edge
  function's own logs, not surfaced back to whoever created the fixture.

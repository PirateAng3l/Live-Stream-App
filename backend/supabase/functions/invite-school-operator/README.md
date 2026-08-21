# invite-school-operator

Edge function that sends a school its first (or another) `school_operator`
login. There's only one kind of operator account in this project — the same
login a school uses on the web `/admin` panel is also what "crew" types
into the Android app's CREW SIGN-IN section (see the top-level README's
crew sign-in section). This function just creates that one account.

## How it gets called

Directly by a platform admin from the web admin panel
(`web/app/admin/school/actions.ts`'s `inviteOperatorAction`), using their
own session token — same as `provision-fixture-broadcast` accepts a
platform admin's session for a manual retry. Nothing else calls this;
there's no database-trigger case the way provisioning has one.

## Why this needs to be an edge function at all

Creating an account *for someone else* (rather than that person signing
themselves up) is only possible with the service-role key — Supabase's
`auth.admin.inviteUserByEmail` isn't reachable with the anon key a normal
signed-in session uses. The web app's server actions never hold the
service-role key (same reasoning as `provision-fixture-broadcast`'s own
README) — this function is the one place that does, scoped to the single
thing only it can do.

## What this deliberately does *not* do

Elevate the invited profile to `school_operator` or set its `school_id`.
`handle_new_user` (migration 0001) still fires and leaves the new profile
at the default `role='parent'`, same as any other sign-up. The elevation
happens back in `inviteOperatorAction`, using the *caller's own*
platform_admin session and the already-existing `profiles_admin_all` RLS
policy — not duplicated in here. That keeps exactly one place responsible
for "who can write to `profiles`" (RLS), and means a failure between the
two steps (invite sent, elevation write fails) just leaves an ordinary
`parent` profile sitting there to retry, not a half-privileged account.

## Files

- **`authorize.ts`** — `isAuthorizedToInvite`: platform_admin only, no
  other caller is trusted (contrast with `provision-fixture-broadcast`,
  which also trusts its own database trigger's service-role credential).
- **`index.ts`** — the Deno entrypoint. Verifies the caller's session and
  role, then calls `inviteUserByEmail`.
- **`authorize.test.ts`** — unit tests for the one thing worth unit
  testing here, run with `deno test`.

## Running the tests

```
cd backend/supabase/functions/invite-school-operator
deno test --allow-env *.test.ts
deno check *.ts
deno lint *.ts
deno fmt --check *.ts
```

All of the above pass as of this writing.

## Deploying (not done yet)

```
supabase functions deploy invite-school-operator --project-ref <your-project-ref>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically
by the Supabase runtime — no extra secrets to set, unlike
`provision-fixture-broadcast`'s Google OAuth credentials.

## Not built yet

- No re-send/expire handling — if an invite email is lost or the link
  expires, there's currently no "resend" button; re-running the invite
  action against the same email will just fail (`inviteUserByEmail`
  rejects an email that already has an account, invited or not).
- No way for a school_operator to invite a colleague at their own
  school — platform_admin only for now, same as every other account-
  creation path in this project.

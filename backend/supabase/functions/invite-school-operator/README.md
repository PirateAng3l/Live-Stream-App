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

The caller also passes `redirectTo` — the web app's own `/set-password`
page (see `web/README.md` for why this project's Supabase Auth Flow type
has to be **implicit**, not PKCE, for this to actually work with an
admin-triggered email). This function has no idea what the web app's URL
is (no `NEXT_PUBLIC_*` env vars reach a Deno function), so it just
forwards whatever it's given straight into `inviteUserByEmail`'s own
`redirectTo` option. Omitting it isn't a safe default: Supabase falls back
to the project's Site URL, which is how an early version of this landed
invited people on the marketing homepage with no way to ever set a
password.

Recovering a lost or expired invite doesn't come back through here at
all — `resendOperatorInviteAction` (same file) calls
`supabase.auth.resetPasswordForEmail` directly instead, since resending
doesn't create anything new and so doesn't need the service-role key this
function exists for.

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

- No way for a school_operator to invite a colleague at their own
  school — platform_admin only for now, same as every other account-
  creation path in this project.

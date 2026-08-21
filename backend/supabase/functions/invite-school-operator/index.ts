// Deno entrypoint. Creates the auth.users account for a new school
// operator — the one privileged step in onboarding a school's login,
// since only the service-role key can create an account on someone else's
// behalf (a normal signUp() call always signs the caller themselves in,
// which is no good for "platform_admin sets up an account for someone
// else").
//
// Deliberately does NOT touch profiles.role/school_id itself. Elevating a
// profile to school_operator is already covered by the profiles_admin_all
// RLS policy (migration 0001), so the caller
// (web/app/admin/school/actions.ts) does that afterward using its own
// platform_admin session — one source of truth for "who can write to
// profiles" (RLS), not duplicated in here too. If that second write fails,
// the invited account just sits at the default role='parent' until
// retried — recoverable, not a broken state.
//
// Called directly by a platform admin from the web admin panel, using
// their own session token. Nothing else calls this (contrast with
// provision-fixture-broadcast, which a database trigger also calls with
// the service-role key).
//
// The caller passes redirectTo (the web app's own /set-password page) —
// without it, Supabase falls back to the project's configured Site URL,
// which lands the invited person on the marketing homepage with an
// established-but-invisible session and no way to actually set a
// password. This function has no notion of the web app's URL itself
// (it's just a Deno function with no NEXT_PUBLIC_* env vars), so the
// caller supplies it.

import { createClient } from "npm:@supabase/supabase-js@2";
import { isAuthorizedToInvite } from "./authorize.ts";
import type { CallerProfile } from "./authorize.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      {
        status: 401,
      },
    );
  }

  const { email, redirectTo } = await req.json().catch(() => ({
    email: undefined,
    redirectTo: undefined,
  }));
  if (!email || typeof email !== "string") {
    return new Response(JSON.stringify({ error: "email is required" }), {
      status: 400,
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
    });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  const callerProfile: CallerProfile | null = profile
    ? { role: profile.role }
    : null;

  if (!isAuthorizedToInvite(callerProfile)) {
    return new Response(
      JSON.stringify({ error: "Only a platform admin can invite an operator" }),
      { status: 403 },
    );
  }

  const { data: invited, error: inviteError } = await admin.auth.admin
    .inviteUserByEmail(
      email,
      typeof redirectTo === "string" && redirectTo ? { redirectTo } : undefined,
    );
  if (inviteError || !invited.user) {
    return new Response(
      JSON.stringify({
        error: inviteError?.message ?? "Could not send invite",
      }),
      { status: 502 },
    );
  }

  return new Response(JSON.stringify({ user_id: invited.user.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// Deno entrypoint for the Supabase Edge Function. Deliberately thin: parse
// the request, check who's allowed to call it, then hand off to
// provisionFixtureBroadcast (provision.ts) for the actual work. All the
// logic worth testing lives there, in youtube.ts, and in authorize.ts —
// not here.
//
// Runs with the service-role key (bypasses RLS) since it has to read the
// YouTube refresh token and write the stream key — both locked out of
// every normal role by RLS on purpose. That means THIS function is the
// thing responsible for authorization, not the database.
//
// Called from two different places: automatically by the
// on_fixture_created_provision_broadcast database trigger (migration
// 0002) right after a fixture is inserted — using the service-role key
// as its own credential, since a trigger has no human session to act as —
// and directly by a platform admin or a fixture's own school_operator
// (e.g. to retry after a failure). See authorize.ts for why trusting the
// service-role caller unconditionally is safe.

import { createClient } from "npm:@supabase/supabase-js@2";
import { decodeJwtPayload, isAuthorizedToProvision } from "./authorize.ts";
import type { CallerProfile } from "./authorize.ts";
import { createSupabaseProvisionDb } from "./db.ts";
import { provisionFixtureBroadcast } from "./provision.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
  const googleClientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      { status: 401 },
    );
  }
  const jwtRole = (decodeJwtPayload(jwt)?.role as string | undefined) ?? null;

  const { fixture_id: fixtureId } = await req.json().catch(() => ({
    fixture_id: undefined,
  }));
  if (!fixtureId) {
    return new Response(JSON.stringify({ error: "fixture_id is required" }), {
      status: 400,
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Only look up a human caller's profile when this isn't the trigger
  // calling with the service-role key — there's no profile to find for
  // that, and none is needed (see authorize.ts).
  let callerProfile: CallerProfile | null = null;
  if (jwtRole !== "service_role") {
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
      });
    }
    const { data: profile } = await admin
      .from("profiles")
      .select("role, school_id")
      .eq("id", userData.user.id)
      .single();
    callerProfile = profile
      ? { role: profile.role, schoolId: profile.school_id }
      : null;
  }

  const { data: fixture, error: fixtureError } = await admin
    .from("fixtures")
    .select("host_school_id")
    .eq("id", fixtureId)
    .single();
  if (fixtureError || !fixture) {
    return new Response(JSON.stringify({ error: "Fixture not found" }), {
      status: 404,
    });
  }

  const authorized = isAuthorizedToProvision({
    jwtRole,
    profile: callerProfile,
    fixtureHostSchoolId: fixture.host_school_id,
  });
  if (!authorized) {
    return new Response(
      JSON.stringify({ error: "Not allowed to provision this fixture" }),
      { status: 403 },
    );
  }

  try {
    const result = await provisionFixtureBroadcast(fixtureId, {
      db: createSupabaseProvisionDb(admin),
      fetchFn: fetch,
      googleClientId,
      googleClientSecret,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 502,
    });
  }
});

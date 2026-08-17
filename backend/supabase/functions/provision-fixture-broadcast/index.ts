// Deno entrypoint for the Supabase Edge Function. Deliberately thin: parse
// the request, check who's allowed to call it, then hand off to
// provisionFixtureBroadcast (provision.ts) for the actual work. All the
// logic worth testing lives there and in youtube.ts, not here.
//
// Runs with the service-role key (bypasses RLS) since it has to read the
// YouTube refresh token and write the stream key — both locked out of
// every normal role by RLS on purpose. That means THIS function is the
// thing responsible for authorization, not the database: only a platform
// admin, or the school_operator who belongs to the fixture's host school,
// may call this.

import { createClient } from "npm:@supabase/supabase-js@2";
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

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
    });
  }

  const { fixture_id: fixtureId } = await req.json().catch(() => ({
    fixture_id: undefined,
  }));
  if (!fixtureId) {
    return new Response(JSON.stringify({ error: "fixture_id is required" }), {
      status: 400,
    });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, school_id")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ error: "No profile for this account" }),
      { status: 403 },
    );
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

  const authorized = profile.role === "platform_admin" ||
    (profile.role === "school_operator" &&
      profile.school_id === fixture.host_school_id);
  if (!authorized) {
    return new Response(
      JSON.stringify({ error: "Not allowed to provision this fixture" }),
      {
        status: 403,
      },
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

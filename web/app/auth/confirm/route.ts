import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Where the invite/recovery emails' redirectTo actually points
 * (setPasswordRedirectUrl in admin/school/actions.ts) — not /set-password
 * directly. This project's Supabase Auth is on the PKCE link flow, not the
 * older implicit one: the email link lands here with a one-time `?code=`
 * query param, not a URL hash carrying an already-usable session. That
 * code has to be explicitly exchanged for a session — nothing does that
 * automatically the way detectSessionInUrl does for a hash — and it has to
 * happen in a place that can actually persist the resulting cookies. A
 * Server Component (which /set-password's page otherwise is) can't write
 * cookies; a Route Handler can, same as a Server Action can — so this is
 * the one correct place for exchangeCodeForSession to run.
 *
 * Once the session is established here (as real cookies, synced to the
 * client's own Supabase instance automatically), /set-password itself
 * needs nothing PKCE-specific at all — it just sees a normal signed-in
 * session, same as any other page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/set-password`);
    }
  }

  return NextResponse.redirect(`${origin}/set-password?error=invalid_link`);
}

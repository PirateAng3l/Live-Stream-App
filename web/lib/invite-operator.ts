import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Not the link itself — the *base* the Invite user / Reset Password email
 * templates build their link from, via Supabase's `{{ .RedirectTo }}`
 * template variable (Authentication → Emails → Templates, dashboard-only,
 * this app can't set it). Those templates are set to
 * `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite` (or
 * `type=recovery`) instead of Supabase's default `{{ .ConfirmationURL }}`
 * — that default routes through Supabase's own PKCE-flow verify redirect,
 * which hands off a one-time `?code=` requiring a "code verifier" from
 * the browser that started the auth flow. For an admin-triggered email
 * there is no such browser — confirmed live, every attempt through that
 * default path failed instantly regardless of device. `token_hash` +
 * `verifyOtp()` (SetPasswordForm) sidesteps that: it validates the raw
 * token directly, no prior browser state required — Supabase's own
 * documented pattern for exactly this case.
 *
 * Without an explicit redirectTo at all, `{{ .RedirectTo }}` would be
 * empty and the templates would have nothing to build a link from.
 * Reading the incoming request's own Host header works in every
 * environment (Vercel preview/production, local dev) without a
 * hardcoded env var to keep in sync.
 *
 * Must also be added to Supabase's Auth → URL Configuration → Redirect
 * URLs allow-list, or Supabase silently ignores it — that's a dashboard
 * setting, not something this app can set for itself.
 */
export function setPasswordRedirectUrl(): string {
  return `https://${headers().get("host")}/set-password`;
}

/**
 * The actual "create the account and make it this school's operator" work,
 * shared by inviteOperatorAction (the manual per-school invite form) and
 * approveSchoolRequestAction (which now fires this automatically the moment
 * a request is approved, instead of making a platform_admin come back and
 * trigger it by hand — see the school-requests flow's own README section
 * for why that extra manual step kept getting missed in practice).
 *
 * Two-step by design, split across a privilege boundary:
 *
 * 1. The invite-school-operator edge function creates the auth.users
 *    account — the one thing that genuinely requires the service-role key,
 *    which this app never holds (see that function's own README). Called
 *    with the caller's own session token, not a secret this app stores.
 * 2. The elevation to school_operator happens right here, using the
 *    caller's ordinary RLS-bound session — profiles_admin_all (migration
 *    0001) already lets a platform_admin update any profile, so there's no
 *    reason to duplicate that permission check inside the edge function
 *    too. If this second write fails, the invited account just sits at
 *    the default role='parent' until the operation is retried — a
 *    recoverable state, not a broken one.
 */
export async function inviteSchoolOperator(
  supabase: SupabaseClient,
  params: { email: string; schoolId: string },
): Promise<{ error?: string; success?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Not signed in as staff" };

  const functionsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-school-operator`;
  const response = await fetch(functionsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email: params.email, redirectTo: setPasswordRedirectUrl() }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { error: result.error ?? "Could not send the invite" };

  const { error: elevateError } = await supabase
    .from("profiles")
    .update({ role: "school_operator", school_id: params.schoolId })
    .eq("id", result.user_id);
  if (elevateError) return { error: elevateError.message };

  return { success: `Invite sent to ${params.email}` };
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { authButtonClass, authInputClass } from "../_components";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * The one thing that lands someone here: an invite or password-reset
 * email link (see inviteOperatorAction/resendOperatorInviteAction, both
 * of which point their redirectTo here). Those links carry
 * ?token_hash=...&type=invite (or type=recovery) — set that way
 * deliberately in Supabase's own Invite/Reset Password email templates
 * (Authentication → Emails → Templates, dashboard-only, this app can't
 * set it), instead of Supabase's default {{ .ConfirmationURL }}, which
 * routes through Supabase's own PKCE-flow verify redirect and hands off a
 * one-time `?code=` requiring a "code verifier" from the browser that
 * started the auth flow — a browser that, for an admin-triggered email,
 * never existed. Confirmed live: every PKCE attempt failed instantly
 * regardless of device. token_hash sidesteps that entirely — verifyOtp()
 * validates the raw token directly against Supabase, no prior browser
 * state required, which is what actually works for a link nobody but the
 * admin ever "started". This is Supabase's own documented pattern for
 * exactly this case (invite/recovery/email-change links), not a
 * workaround.
 *
 * One client instance for the component's whole lifetime (useState's lazy
 * initializer, not created fresh in handleSubmit) so the same instance
 * that verified the token on mount is the one used to update the
 * password afterward.
 */
export function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;

    if (!tokenHash || !type) {
      setReady(true);
      setError("This link has expired or was already used. Ask your admin to resend it.");
      return;
    }

    supabase.auth.verifyOtp({ type, token_hash: tokenHash }).then(({ error: verifyError }) => {
      setReady(true);
      if (verifyError) {
        setError("This link has expired or was already used. Ask your admin to resend it.");
      }
    });
  }, [supabase, searchParams]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setSubmitting(false);
      setError(
        updateError.message.toLowerCase().includes("session")
          ? "This link has expired or was already used. Ask your admin to resend it."
          : updateError.message,
      );
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Set your password</h1>
      <p className="mb-6 text-sm text-textsecondary">
        Choose a password to finish setting up your account.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Password (min. 6 characters)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={authInputClass}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className={authInputClass}
        />
        {error && <p className="text-sm text-live">{error}</p>}
        <button type="submit" disabled={submitting || !ready} className={authButtonClass}>
          {submitting ? "Saving…" : ready ? "Set password" : "Loading…"}
        </button>
      </form>
    </div>
  );
}

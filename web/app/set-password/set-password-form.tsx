"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { authButtonClass, authInputClass } from "../_components";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * The one thing that lands someone here: an invite or password-reset
 * email link (see inviteOperatorAction/resendOperatorInviteAction, both
 * of which point their redirectTo here). That link hands off a session
 * through the page's own URL fragment (#access_token=...) — this project's
 * Supabase Auth is deliberately set to the *implicit* flow rather than
 * PKCE (Authentication → Sign In / Providers → Email → Flow type, in the
 * Supabase dashboard) specifically because of this: PKCE's `?code=`
 * requires a matching "code verifier" stored in the browser that started
 * the flow, but for an admin-triggered invite/reset email there is no
 * such browser — the recipient's browser never started anything, so no
 * verifier could ever exist for it. Confirmed live: every PKCE attempt
 * failed instantly regardless of device or timing, which is exactly what
 * that mismatch predicts. Implicit flow has no verifier step at all — the
 * session rides along in the link itself — which is what makes it work
 * for a link nobody but the admin ever "started".
 *
 * The Supabase client parses that hash fragment and exchanges it for a
 * session asynchronously right after being constructed
 * (detectSessionInUrl, on by default). One client instance for the
 * component's whole lifetime (useState's lazy initializer, not created
 * fresh in handleSubmit) so a second, later-constructed client isn't
 * racing the first one's still-in-flight parsing — and getSession() on
 * mount explicitly waits for that same client's parsing to settle before
 * the form becomes submittable.
 */
export function SetPasswordForm() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(true);
      if (!data.session) {
        setError("This link has expired or was already used. Ask your admin to resend it.");
      }
    });
  }, [supabase]);

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

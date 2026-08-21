"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { authButtonClass, authInputClass } from "../_components";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * The one thing that lands someone here: an invite or password-reset
 * email link (see inviteOperatorAction/resendOperatorInviteAction, both
 * of which point their redirectTo here). That link hands off a session
 * through the page's own URL fragment (#access_token=...), which the
 * Supabase client parses and exchanges for a real session asynchronously
 * right after it's constructed (detectSessionInUrl, on by default).
 *
 * One client instance for the component's whole lifetime (created via
 * useState's lazy initializer, not fresh in handleSubmit) — building a
 * *second* client at submit time, as this used to do, meant its own
 * detectSessionInUrl work hadn't necessarily finished before updateUser()
 * ran right after, and calling getSession() up front here explicitly
 * waits for that same client's own in-flight parsing to settle (GoTrueClient
 * methods await their internal init promise) rather than racing it.
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

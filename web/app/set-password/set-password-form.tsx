"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { authButtonClass, authInputClass } from "../_components";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * The one thing that lands someone here: /auth/confirm, right after it's
 * exchanged an invite/recovery email link's one-time code for a real
 * session (see that route's own comment for why that exchange has to
 * happen server-side, not here). By the time this renders, the session
 * already exists as a cookie — this component doesn't parse a link or a
 * code itself, it just confirms a session is actually there
 * (getSession()) before letting the form submit, and calls
 * updateUser({ password }) against it.
 *
 * One client instance for the component's whole lifetime (useState's lazy
 * initializer, not created fresh in handleSubmit) so the same instance
 * that confirmed the session on mount is the one used to update it.
 */
export function SetPasswordForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialError) return;
    supabase.auth.getSession().then(({ data }) => {
      setReady(true);
      if (!data.session) {
        setError("This link has expired or was already used. Ask your admin to resend it.");
      }
    });
    // initialError is only ever set from the server-rendered initial
    // props, never changes client-side — safe to leave out of the deps
    // list rather than re-running this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <button type="submit" disabled={submitting || (!ready && !initialError)} className={authButtonClass}>
          {submitting ? "Saving…" : ready || initialError ? "Set password" : "Loading…"}
        </button>
      </form>
    </div>
  );
}

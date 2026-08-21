"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authButtonClass, authInputClass } from "../_components";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * The one thing that lands someone here: an invite or password-reset
 * email link (see inviteOperatorAction/resendOperatorInviteAction, both
 * of which point their redirectTo here). Supabase's client already
 * establishes a session from that link's URL fragment on page load
 * (detectSessionInUrl, on by default) — this form doesn't need to parse
 * anything itself, just call updateUser() and let a missing/expired
 * session surface as a normal error from that call.
 */
export function SetPasswordForm() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setSubmitting(false);
      setError(
        updateError.message.includes("session")
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
        <button type="submit" disabled={submitting} className={authButtonClass}>
          {submitting ? "Saving…" : "Set password"}
        </button>
      </form>
    </div>
  );
}

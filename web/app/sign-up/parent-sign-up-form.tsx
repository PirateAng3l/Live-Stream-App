"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authButtonClass, authInputClass } from "../_components";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function ParentSignUpForm({ redirectTarget }: { redirectTarget: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setSubmitting(false);
      setError(signUpError.message);
      return;
    }

    // Whether this account is usable immediately depends on whether email
    // confirmation is turned on for the Supabase project (default: on).
    // With it on, signUp() creates the account but returns no session.
    if (data.session) {
      router.push(redirectTarget);
      router.refresh();
      return;
    }

    setSubmitting(false);
    setConfirmationSent(true);
  }

  if (confirmationSent) {
    return (
      <div>
        <h2 className="mb-2 text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-textsecondary">
          We sent a confirmation link to {email}. Click it, then{" "}
          <Link href={`/sign-in?redirect=${encodeURIComponent(redirectTarget)}`} className="text-accent">
            sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className={authInputClass}
      />
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
      {error && <p className="text-sm text-live">{error}</p>}
      <button type="submit" disabled={submitting} className={authButtonClass}>
        {submitting ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}

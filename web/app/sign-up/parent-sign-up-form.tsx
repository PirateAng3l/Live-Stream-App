"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authButtonClass, authInputClass } from "../_components";
import type { SchoolOption } from "@/lib/admin";
import { writePendingFavouriteSchoolIds } from "@/lib/favourites-pending";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function ParentSignUpForm({
  redirectTarget,
  schools,
}: {
  redirectTarget: string;
  schools: SchoolOption[];
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggleSchool(schoolId: string) {
    setSelectedSchoolIds((current) =>
      current.includes(schoolId) ? current.filter((id) => id !== schoolId) : [...current, schoolId],
    );
  }

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
    // With it on, signUp() creates the account but returns no session, so
    // there's no auth.uid() yet for the favourites RLS policy to check —
    // the pick is stashed instead and FavouritesSync applies it once the
    // parent actually has a session (see lib/favourites-pending.ts).
    if (data.session) {
      if (selectedSchoolIds.length > 0) {
        await supabase
          .from("favourites")
          .insert(selectedSchoolIds.map((schoolId) => ({ parent_id: data.session!.user.id, school_id: schoolId })));
      }
      router.push(redirectTarget);
      router.refresh();
      return;
    }

    writePendingFavouriteSchoolIds(selectedSchoolIds);
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

      {schools.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">
            Which school(s) do you support? <span className="font-normal text-textsecondary">(optional)</span>
          </p>
          <p className="mb-2 text-xs text-textsecondary">
            Your schedule will only show fixtures from the schools you pick here. Leave this blank to see
            every school&apos;s fixtures instead — you can change this later from your account.
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-panel p-3">
            {schools.map((school) => (
              <label key={school.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedSchoolIds.includes(school.id)}
                  onChange={() => toggleSchool(school.id)}
                  className="h-4 w-4 rounded border-white/20"
                />
                {school.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-live">{error}</p>}
      <button type="submit" disabled={submitting} className={authButtonClass}>
        {submitting ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}

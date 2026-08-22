"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authButtonClass, authInputClass } from "../_components";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Spec 4.5's takedown/opt-out intake — deliberately no sign-in required
 * (a concerned parent may not have an account, and shouldn't need one to
 * raise a safeguarding concern), same public-insert-then-admin-reviews
 * shape as SchoolRequestForm/school_signup_requests. fixture_id is
 * pre-filled from ?fixture= when reached via a match page's own "Report a
 * concern" link, but stays editable/optional — a reporter arriving here
 * directly (e.g. from a shared screenshot, not the site itself) won't
 * have that.
 */
export function ReportConcernForm() {
  const searchParams = useSearchParams();
  const [fixtureId] = useState(() => searchParams.get("fixture") ?? "");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from("concern_reports").insert({
      fixture_id: fixtureId || null,
      reporter_name: reporterName || null,
      reporter_email: reporterEmail,
      description,
    });

    if (insertError) {
      setSubmitting(false);
      setError(insertError.message);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-2 text-2xl font-bold">Report received</h1>
        <p className="text-sm text-textsecondary">
          Thank you for letting us know — we take these seriously and will follow up at {reporterEmail} as soon
          as possible.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Report a concern</h1>
      <p className="mb-6 text-sm text-textsecondary">
        Use this form for any concern about footage on this site — including a request to take down a video
        featuring your child. We review every report.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          placeholder="Your name (optional)"
          value={reporterName}
          onChange={(event) => setReporterName(event.target.value)}
          className={authInputClass}
        />
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Your email"
          value={reporterEmail}
          onChange={(event) => setReporterEmail(event.target.value)}
          className={authInputClass}
        />
        {fixtureId && (
          <p className="text-xs text-textsecondary">This report will be linked to the match you came from.</p>
        )}
        <textarea
          required
          placeholder="What's the concern?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className={authInputClass}
        />
        {error && <p className="text-sm text-live">{error}</p>}
        <button type="submit" disabled={submitting} className={authButtonClass}>
          {submitting ? "Sending…" : "Send report"}
        </button>
      </form>
    </div>
  );
}

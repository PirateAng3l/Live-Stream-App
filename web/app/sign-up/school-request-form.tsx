"use client";

import { type FormEvent, useState } from "react";
import { authButtonClass, authInputClass } from "../_components";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Unlike ParentSignUpForm, this never creates an auth.users account or a
 * session — it's a public insert into school_signup_requests (migration
 * 0007), reviewed by a platform_admin at /admin/school-requests. A school
 * only gets real access once that request is approved; "signing up" here
 * on its own doesn't hand out anything to sign in with.
 */
export function SchoolRequestForm() {
  const [schoolName, setSchoolName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from("school_signup_requests").insert({
      school_name: schoolName,
      contact_name: contactName || null,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      notes: notes || null,
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
      <div>
        <h2 className="mb-2 text-lg font-semibold">Request received</h2>
        <p className="text-sm text-textsecondary">
          We&apos;ll review your request and be in touch at {contactEmail} once your school&apos;s set up.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        required
        placeholder="School name"
        value={schoolName}
        onChange={(event) => setSchoolName(event.target.value)}
        className={authInputClass}
      />
      <input
        placeholder="Your name (optional)"
        value={contactName}
        onChange={(event) => setContactName(event.target.value)}
        className={authInputClass}
      />
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Contact email"
        value={contactEmail}
        onChange={(event) => setContactEmail(event.target.value)}
        className={authInputClass}
      />
      <input
        placeholder="Contact phone (optional)"
        value={contactPhone}
        onChange={(event) => setContactPhone(event.target.value)}
        className={authInputClass}
      />
      <textarea
        placeholder="Tell us about your school (sports, rough student numbers, anything useful) — optional"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={3}
        className={authInputClass}
      />
      {error && <p className="text-sm text-live">{error}</p>}
      <button type="submit" disabled={submitting} className={authButtonClass}>
        {submitting ? "Sending…" : "Request access"}
      </button>
    </form>
  );
}

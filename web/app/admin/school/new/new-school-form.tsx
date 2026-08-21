"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../../_components";
import { createSchoolAction, type ActionState } from "../actions";

const initialState: ActionState = {};

export function NewSchoolForm() {
  const [state, formAction] = useFormState(createSchoolAction, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Create school</h1>
      <p className="mb-6 text-sm text-textsecondary">
        Adds the school to the platform. You can upload its logo and add teams right after.
      </p>
      <form action={formAction} className="space-y-4">
        <input name="name" required placeholder="School name" className={authInputClass} />
        <input
          name="contact_email"
          type="email"
          placeholder="Contact email (optional)"
          className={authInputClass}
        />
        <input name="contact_phone" placeholder="Contact phone (optional)" className={authInputClass} />
        {state?.error && <p className="text-sm text-live">{state.error}</p>}
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={authButtonClass}>
      {pending ? "Creating…" : "Create school"}
    </button>
  );
}

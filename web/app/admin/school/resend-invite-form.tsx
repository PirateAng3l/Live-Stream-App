"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../_components";
import { resendOperatorInviteAction, type ActionState } from "./actions";

const initialState: ActionState = {};

/**
 * Not scoped to a particular school — resetPasswordForEmail (the action
 * behind this) just emails a set-password link to whatever account matches,
 * wherever it belongs. Sits below OperatorInviteForm because that's where
 * an admin would think to look for it, not because it's tied to the school
 * currently selected on this page.
 */
export function ResendInviteForm() {
  const [state, formAction] = useFormState(resendOperatorInviteAction, initialState);

  return (
    <div className="mx-auto mt-6 max-w-sm">
      <h2 className="mb-1 text-sm font-semibold text-textsecondary">Lost an invite, or can&apos;t sign in?</h2>
      <form action={formAction} className="mt-2 flex gap-2">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Operator's email"
          className={authInputClass}
        />
        <SubmitButton />
      </form>
      {state?.error && <p className="mt-2 text-sm text-live">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-ok">{state.success}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-lg bg-panel px-4 py-2 text-sm font-semibold text-textprimary disabled:opacity-50"
    >
      {pending ? "Sending…" : "Resend"}
    </button>
  );
}

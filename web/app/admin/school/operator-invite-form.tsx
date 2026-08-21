"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../_components";
import type { SchoolDetail } from "@/lib/admin";
import { inviteOperatorAction, type ActionState } from "./actions";

const initialState: ActionState = {};

/**
 * There's only one kind of operator account in this project — the same
 * login works on this admin panel and the broadcaster app's CREW SIGN-IN
 * (see the top-level README). This form is the one place that creates it;
 * invited-but-not-yet-accepted accounts aren't listed anywhere yet, so
 * re-inviting the same email before they've accepted will just fail
 * (see the edge function's own README).
 */
export function OperatorInviteForm({
  school,
  defaultEmail,
}: {
  school: SchoolDetail;
  defaultEmail?: string;
}) {
  const [state, formAction] = useFormState(inviteOperatorAction, initialState);

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h2 className="mb-1 text-lg font-semibold">Invite an operator</h2>
      <p className="mb-4 text-sm text-textsecondary">
        Sends an email so someone at {school.name} can sign in — the same login works here and on
        the broadcaster app.
      </p>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="school_id" value={school.id} />
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Operator's email"
          defaultValue={defaultEmail}
          className={authInputClass}
        />
        {state?.error && <p className="text-sm text-live">{state.error}</p>}
        {state?.success && <p className="text-sm text-ok">{state.success}</p>}
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={authButtonClass}>
      {pending ? "Sending…" : "Send invite"}
    </button>
  );
}

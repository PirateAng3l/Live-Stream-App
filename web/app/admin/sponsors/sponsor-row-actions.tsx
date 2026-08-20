"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { deleteSponsorAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function SponsorRowActions({ sponsorId }: { sponsorId: string }) {
  const [state, formAction] = useFormState(deleteSponsorAction, initialState);

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/admin/sponsors/${sponsorId}/edit`}
        className="text-xs font-semibold text-textsecondary hover:text-textprimary"
      >
        Edit
      </Link>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm("Delete this sponsor? It will also be removed from any fixtures it's assigned to.")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="sponsor_id" value={sponsorId} />
        <DeleteSubmitButton />
      </form>
      {state?.error && <p className="text-xs text-live">{state.error}</p>}
    </div>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-xs font-semibold text-live hover:underline disabled:opacity-50">
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

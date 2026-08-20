"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { deleteTeamAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function TeamRowActions({ teamId }: { teamId: string }) {
  const [state, formAction] = useFormState(deleteTeamAction, initialState);

  return (
    <div className="flex items-center gap-3">
      <Link href={`/admin/teams/${teamId}/edit`} className="text-xs font-semibold text-textsecondary hover:text-textprimary">
        Edit
      </Link>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm("Delete this team?")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="team_id" value={teamId} />
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

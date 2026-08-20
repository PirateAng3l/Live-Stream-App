"use client";

import { useFormState, useFormStatus } from "react-dom";
import { deleteFixtureAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function DeleteFixtureForm({ fixtureId }: { fixtureId: string }) {
  const [state, formAction] = useFormState(deleteFixtureAction, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Delete this fixture? This also removes its stream key and sponsor assignments. This cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="fixture_id" value={fixtureId} />
      <DeleteSubmitButton />
      {state?.error && <p className="mt-1 text-xs text-live">{state.error}</p>}
    </form>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-live/40 px-4 py-2 text-sm font-semibold text-live hover:bg-live/10 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete fixture"}
    </button>
  );
}

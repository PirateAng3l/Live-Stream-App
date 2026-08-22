"use client";

import { useFormState, useFormStatus } from "react-dom";
import { deleteFixtureAction, toggleFixtureVisibilityAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function VisibilityToggleForm({ fixtureId, hidden }: { fixtureId: string; hidden: boolean }) {
  const [state, formAction] = useFormState(toggleFixtureVisibilityAction, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const message = hidden
          ? "Make this fixture's video visible to viewers again?"
          : "Take down this fixture's video? It stops showing on the match page for everyone immediately — this can be reversed.";
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="fixture_id" value={fixtureId} />
      <input type="hidden" name="hide" value={(!hidden).toString()} />
      <VisibilityToggleButton hidden={hidden} />
      {state?.error && <p className="mt-1 text-xs text-live">{state.error}</p>}
    </form>
  );
}

function VisibilityToggleButton({ hidden }: { hidden: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        hidden
          ? "rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-textprimary hover:border-accent disabled:opacity-50"
          : "rounded-full border border-live/40 px-4 py-2 text-sm font-semibold text-live hover:bg-live/10 disabled:opacity-50"
      }
    >
      {pending ? "Saving…" : hidden ? "Make video visible again" : "Take down video"}
    </button>
  );
}

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

"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { SchoolOption } from "@/lib/admin";
import { updateFavouriteSchoolsAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function FavouriteSchoolsForm({
  schools,
  favouriteSchoolIds,
}: {
  schools: SchoolOption[];
  favouriteSchoolIds: string[];
}) {
  const [state, formAction] = useFormState(updateFavouriteSchoolsAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-panel p-3">
        {schools.map((school) => (
          <label key={school.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="school_id"
              value={school.id}
              defaultChecked={favouriteSchoolIds.includes(school.id)}
              className="h-4 w-4 rounded border-white/20"
            />
            {school.name}
          </label>
        ))}
      </div>
      <SaveButton />
      {state?.error && <p className="text-sm text-live">{state.error}</p>}
      {state?.saved && <p className="text-sm text-ok">Saved.</p>}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

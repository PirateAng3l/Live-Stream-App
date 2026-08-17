"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../../_components";
import { SPORTS, sportLabel } from "@/lib/sports";
import { createTeamAction, type ActionState } from "../actions";

const initialState: ActionState = {};

export function NewTeamForm({ schoolId }: { schoolId: string }) {
  const [state, formAction] = useFormState(createTeamAction, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">New team</h1>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="school_id" value={schoolId} />
        <input name="name" required placeholder="Team name" className={authInputClass} />
        <select name="sport" required defaultValue="" className={authInputClass}>
          <option value="" disabled>
            Sport
          </option>
          {SPORTS.map((sport) => (
            <option key={sport} value={sport}>
              {sportLabel(sport)}
            </option>
          ))}
        </select>
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
      {pending ? "Saving…" : "Create team"}
    </button>
  );
}

"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../../../_components";
import type { TeamDetail } from "@/lib/admin";
import { SPORTS, sportLabel } from "@/lib/sports";
import { updateTeamAction, type ActionState } from "../../actions";

const initialState: ActionState = {};

export function EditTeamForm({ team }: { team: TeamDetail }) {
  const [state, formAction] = useFormState(updateTeamAction, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Edit team</h1>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="team_id" value={team.id} />
        <input name="name" required defaultValue={team.name} placeholder="Team name" className={authInputClass} />
        <select name="sport" required defaultValue={team.sport} className={authInputClass}>
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
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

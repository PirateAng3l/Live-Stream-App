"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../../_components";
import type { TeamOption } from "@/lib/admin";
import { SPORTS, sportLabel } from "@/lib/sports";
import { createFixtureAction, type ActionState } from "../actions";

const initialState: ActionState = {};

export function NewFixtureForm({ schoolId, teams }: { schoolId: string; teams: TeamOption[] }) {
  const [state, formAction] = useFormState(createFixtureAction, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">New fixture</h1>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="school_id" value={schoolId} />

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

        <select name="home_team_id" required defaultValue="" className={authInputClass}>
          <option value="" disabled>
            Home team
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>

        <select name="away_team_id" required defaultValue="" className={authInputClass}>
          <option value="" disabled>
            Away team
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          name="scheduled_start"
          required
          className={authInputClass}
          aria-label="Kickoff time"
        />

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
      {pending ? "Creating…" : "Create fixture"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../../_components";
import type { TeamOption } from "@/lib/admin";
import { SPORTS, sportLabel } from "@/lib/sports";
import { createFixtureAction, type ActionState } from "../actions";

const initialState: ActionState = {};

export function NewFixtureForm({ schoolId, teams }: { schoolId: string; teams: TeamOption[] }) {
  const [state, formAction] = useFormState(createFixtureAction, initialState);
  // A Clean Slate/Event fixture (a prize-giving, a concert) has no
  // opposing team — away_team_id isn't rendered at all for it, so the
  // form never submits one and createFixtureAction doesn't require it.
  const [sport, setSport] = useState("");
  const isCleanSlate = sport === "other";

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">New fixture</h1>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="school_id" value={schoolId} />

        <select
          name="sport"
          required
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className={authInputClass}
        >
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
            {isCleanSlate ? "Team" : "Home team"}
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>

        {!isCleanSlate && (
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
        )}

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

"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../../../_components";
import type { TeamOption } from "@/lib/admin";
import type { FixtureSummary } from "@/lib/fixtures";
import { SPORTS, sportLabel } from "@/lib/sports";
import { updateFixtureAction, type ActionState } from "../actions";

const initialState: ActionState = {};

/**
 * datetime-local inputs have no timezone of their own — the browser reads
 * whatever's typed as local wall-clock time, and createFixtureAction /
 * updateFixtureAction both just do `new Date(value).toISOString()`, which
 * interprets it as the browser's local time and converts to UTC for
 * storage. So prefilling this field has to invert that exact conversion:
 * take the stored UTC instant and format it back out using the same local
 * Date getters the browser used going in, or a re-save without touching
 * this field would silently shift the kickoff time.
 */
function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function EditFixtureForm({ fixture, teams }: { fixture: FixtureSummary; teams: TeamOption[] }) {
  const [state, formAction] = useFormState(updateFixtureAction, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Edit fixture</h1>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="fixture_id" value={fixture.id} />

        <select name="sport" required defaultValue={fixture.sport} className={authInputClass}>
          {SPORTS.map((sport) => (
            <option key={sport} value={sport}>
              {sportLabel(sport)}
            </option>
          ))}
        </select>

        <select name="home_team_id" required defaultValue={fixture.homeTeamId} className={authInputClass}>
          <option value="" disabled>
            Home team
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>

        <select name="away_team_id" required defaultValue={fixture.awayTeamId} className={authInputClass}>
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
          defaultValue={toDatetimeLocalValue(fixture.scheduledStart)}
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
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

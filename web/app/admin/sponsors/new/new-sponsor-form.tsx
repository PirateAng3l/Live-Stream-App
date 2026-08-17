"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../../_components";
import { SPONSOR_POSITIONS, SPONSOR_TIERS, sponsorPositionLabel, sponsorTierLabel } from "@/lib/sponsors";
import { createSponsorAction, type ActionState } from "../actions";

const initialState: ActionState = {};

export function NewSponsorForm({ schoolId }: { schoolId: string }) {
  const [state, formAction] = useFormState(createSponsorAction, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">New sponsor</h1>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="school_id" value={schoolId} />
        <input name="name" required placeholder="Sponsor name" className={authInputClass} />

        <select name="tier" required defaultValue="" className={authInputClass}>
          <option value="" disabled>
            Tier
          </option>
          {SPONSOR_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {sponsorTierLabel(tier)}
            </option>
          ))}
        </select>

        <select name="default_position" required defaultValue="" className={authInputClass}>
          <option value="" disabled>
            Default position
          </option>
          {SPONSOR_POSITIONS.map((position) => (
            <option key={position} value={position}>
              {sponsorPositionLabel(position)}
            </option>
          ))}
        </select>

        <input
          name="logo_url"
          type="url"
          placeholder="Logo URL (optional)"
          className={authInputClass}
        />
        <input
          name="click_url"
          type="url"
          placeholder="Click-through URL (optional)"
          className={authInputClass}
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
      {pending ? "Saving…" : "Create sponsor"}
    </button>
  );
}

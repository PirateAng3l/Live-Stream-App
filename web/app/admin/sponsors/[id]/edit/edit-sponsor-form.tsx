"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../../../_components";
import { SPONSOR_POSITIONS, SPONSOR_TIERS, sponsorPositionLabel, sponsorTierLabel } from "@/lib/sponsors";
import type { SponsorDetail } from "@/lib/sponsors-server";
import { updateSponsorAction, type ActionState } from "../../actions";

const initialState: ActionState = {};

export function EditSponsorForm({ sponsor }: { sponsor: SponsorDetail }) {
  const [state, formAction] = useFormState(updateSponsorAction, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <h2 className="mb-6 text-lg font-semibold">Sponsor details</h2>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="sponsor_id" value={sponsor.id} />
        <input
          name="name"
          required
          defaultValue={sponsor.name}
          placeholder="Sponsor name"
          className={authInputClass}
        />

        <select name="tier" required defaultValue={sponsor.tier} className={authInputClass}>
          {SPONSOR_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {sponsorTierLabel(tier)}
            </option>
          ))}
        </select>

        <select name="default_position" required defaultValue={sponsor.defaultPosition} className={authInputClass}>
          {SPONSOR_POSITIONS.map((position) => (
            <option key={position} value={position}>
              {sponsorPositionLabel(position)}
            </option>
          ))}
        </select>

        <input
          name="click_url"
          type="url"
          defaultValue={sponsor.clickUrl ?? ""}
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
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

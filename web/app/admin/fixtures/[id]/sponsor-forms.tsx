"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass, authInputClass } from "../../../_components";
import type { SponsorOption } from "@/lib/sponsors";
import {
  SPONSOR_LAYERS,
  SPONSOR_POSITIONS,
  SPONSOR_TIERS,
  sponsorLayerLabel,
  sponsorPositionLabel,
  sponsorTierLabel,
} from "@/lib/sponsors";
import { assignSponsorAction, removeSponsorAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function AssignSponsorForm({ fixtureId, sponsors }: { fixtureId: string; sponsors: SponsorOption[] }) {
  const [state, formAction] = useFormState(assignSponsorAction, initialState);

  if (sponsors.length === 0) {
    return (
      <p className="text-sm text-textsecondary">
        This school has no sponsors yet — add one under Sponsors first.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="fixture_id" value={fixtureId} />

      <select name="sponsor_id" required defaultValue="" className={authInputClass}>
        <option value="" disabled>
          Sponsor
        </option>
        {sponsors.map((sponsor) => (
          <option key={sponsor.id} value={sponsor.id}>
            {sponsor.name}
          </option>
        ))}
      </select>

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

      <select name="position" required defaultValue="" className={authInputClass}>
        <option value="" disabled>
          Position
        </option>
        {SPONSOR_POSITIONS.map((position) => (
          <option key={position} value={position}>
            {sponsorPositionLabel(position)}
          </option>
        ))}
      </select>

      <select name="layer" required defaultValue="baked_in" className={authInputClass}>
        {SPONSOR_LAYERS.map((layer) => (
          <option key={layer} value={layer}>
            {sponsorLayerLabel(layer)}
          </option>
        ))}
      </select>

      {state?.error && <p className="text-sm text-live">{state.error}</p>}
      <AssignSubmitButton />
    </form>
  );
}

function AssignSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={authButtonClass}>
      {pending ? "Assigning…" : "Assign sponsor"}
    </button>
  );
}

export function RemoveSponsorForm({
  fixtureId,
  sponsorId,
  layer,
}: {
  fixtureId: string;
  sponsorId: string;
  layer: string;
}) {
  const [state, formAction] = useFormState(removeSponsorAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="fixture_id" value={fixtureId} />
      <input type="hidden" name="sponsor_id" value={sponsorId} />
      <input type="hidden" name="layer" value={layer} />
      <RemoveSubmitButton />
      {state?.error && <p className="mt-1 text-xs text-live">{state.error}</p>}
    </form>
  );
}

function RemoveSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-semibold text-live hover:underline disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

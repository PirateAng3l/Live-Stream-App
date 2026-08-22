"use client";

import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass } from "../../_components";
import type { SchoolDetail } from "@/lib/admin";
import { confirmSchoolConsentAction, type ActionState } from "./actions";

const initialState: ActionState = {};

/**
 * The UI half of migration 0011's consent gate — fixtures_insert_own_school
 * rejects a new fixture outright until consent_confirmed_at is set, so
 * this is what actually unblocks a school rather than just being advisory.
 * Deliberately a factual attestation ("we confirm we hold consent"), not
 * an explanation of what adequate consent looks like — this software
 * can't determine that; see PROJECT_SPEC.md 4.5. school.consentConfirmedAt
 * swapping this to the "Confirmed" branch after a successful submit needs
 * no explicit refresh — submitting a <form action={serverAction}> already
 * re-fetches the Server Component tree once revalidatePath (in the
 * action) has run, same as every other admin form here.
 */
export function ConsentForm({ school }: { school: SchoolDetail }) {
  const [state, formAction] = useFormState(confirmSchoolConsentAction, initialState);

  return (
    <div className="mx-auto mb-8 max-w-sm rounded-lg border border-white/10 bg-panel p-4">
      <h2 className="mb-1 text-lg font-semibold">Broadcast consent</h2>
      {school.consentConfirmedAt ? (
        <p className="text-sm text-ok">
          Confirmed on {new Date(school.consentConfirmedAt).toLocaleDateString()}. New fixtures can be created.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-textsecondary">
            Before this school can create a fixture, someone here needs to confirm your school holds appropriate
            parental/guardian consent to film and publicly broadcast your students during matches.
          </p>
          <form action={formAction}>
            <input type="hidden" name="school_id" value={school.id} />
            <label className="mb-3 flex items-start gap-2 text-sm text-textsecondary">
              <input type="checkbox" required className="mt-1" />
              We confirm this school holds appropriate parental/guardian consent to film and broadcast our
              students during matches, and understands how Open Door Live handles this footage.
            </label>
            {state?.error && <p className="mb-2 text-sm text-live">{state.error}</p>}
            <SubmitButton />
          </form>
        </>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={authButtonClass}>
      {pending ? "Confirming…" : "Confirm consent"}
    </button>
  );
}

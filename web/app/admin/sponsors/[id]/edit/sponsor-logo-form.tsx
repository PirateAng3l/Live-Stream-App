"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { authButtonClass } from "../../../../_components";
import type { SponsorDetail } from "@/lib/sponsors-server";
import { updateSponsorLogoAction, type ActionState } from "../../actions";

const initialState: ActionState = {};

export function SponsorLogoForm({ sponsor }: { sponsor: SponsorDetail }) {
  const [state, formAction] = useFormState(updateSponsorLogoAction, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">Sponsor logo</h1>
      <p className="mb-6 text-sm text-textsecondary">{sponsor.name}</p>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-panel">
          {previewUrl || sponsor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a
            // preview of an arbitrary just-picked/uploaded file, not a
            // known-dimension site asset next/image's optimizer expects.
            <img src={previewUrl ?? sponsor.logoUrl ?? ""} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-textsecondary">No logo</span>
          )}
        </div>
        <p className="text-xs text-textsecondary">
          Shown wherever this sponsor is assigned to a fixture — the website&apos;s match page and,
          once the Android app next loads that fixture, the live broadcast overlay. PNG, JPEG, or
          WebP, up to 5MB.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="sponsor_id" value={sponsor.id} />
        <input
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="w-full text-sm text-textsecondary file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreviewUrl(file ? URL.createObjectURL(file) : null);
          }}
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
      {pending ? "Uploading…" : "Upload logo"}
    </button>
  );
}

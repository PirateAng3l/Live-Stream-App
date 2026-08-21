"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { SchoolSignupRequest } from "@/lib/school-requests";
import { approveSchoolRequestAction, rejectSchoolRequestAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function SchoolRequestRow({ request }: { request: SchoolSignupRequest }) {
  const [approveState, approveAction] = useFormState(approveSchoolRequestAction, initialState);
  const [rejectState, rejectAction] = useFormState(rejectSchoolRequestAction, initialState);

  return (
    <li className="rounded-lg border border-white/10 bg-panel px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{request.schoolName}</p>
          <p className="text-sm text-textsecondary">
            {request.contactName ? `${request.contactName} · ` : ""}
            {request.contactEmail}
            {request.contactPhone ? ` · ${request.contactPhone}` : ""}
          </p>
          {request.notes && <p className="mt-1 text-sm text-textsecondary">{request.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <form action={approveAction}>
            <input type="hidden" name="request_id" value={request.id} />
            <SubmitButton label="Approve" pendingLabel="Approving…" className="bg-ok text-white" />
          </form>
          <form action={rejectAction}>
            <input type="hidden" name="request_id" value={request.id} />
            <SubmitButton label="Reject" pendingLabel="Rejecting…" className="bg-live text-white" />
          </form>
        </div>
      </div>
      {(approveState?.error || rejectState?.error) && (
        <p className="mt-2 text-sm text-live">{approveState?.error ?? rejectState?.error}</p>
      )}
    </li>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${className}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

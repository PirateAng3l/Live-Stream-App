"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { ConcernReport } from "@/lib/concern-reports";
import { setConcernReportStatusAction, type ActionState } from "./actions";

const initialState: ActionState = {};

export function ConcernReportRow({ report }: { report: ConcernReport }) {
  const [state, formAction] = useFormState(setConcernReportStatusAction, initialState);

  return (
    <li className="rounded-lg border border-white/10 bg-panel px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {report.reporterName || "Anonymous"} <span className="font-normal text-textsecondary">— {report.reporterEmail}</span>
          </p>
          <p className="mt-1 text-xs text-textsecondary">{new Date(report.createdAt).toLocaleString()}</p>
        </div>
        {report.fixtureId && (
          <Link href={`/admin/fixtures/${report.fixtureId}`} className="text-xs text-accent hover:underline">
            View fixture
          </Link>
        )}
      </div>
      <p className="mt-2 text-sm">{report.description}</p>
      {report.status === "new" && (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="report_id" value={report.id} />
          <StatusButton status="reviewed" label="Mark reviewed" />
          <StatusButton status="resolved" label="Mark resolved" />
          {state?.error && <p className="text-xs text-live">{state.error}</p>}
        </form>
      )}
    </li>
  );
}

function StatusButton({ status, label }: { status: "reviewed" | "resolved"; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="status"
      value={status}
      disabled={pending}
      className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-textprimary hover:border-accent disabled:opacity-50"
    >
      {label}
    </button>
  );
}

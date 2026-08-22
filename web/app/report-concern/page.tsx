import { Suspense } from "react";
import { ReportConcernForm } from "./report-concern-form";

// ReportConcernForm reads ?fixture= via useSearchParams (pre-filled when
// reached from a match page's "Report a concern" link) — same Suspense
// requirement as /sign-in's own ?redirect= handling.
export default function ReportConcernPage() {
  return (
    <Suspense>
      <ReportConcernForm />
    </Suspense>
  );
}

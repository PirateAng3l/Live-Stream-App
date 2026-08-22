import { Suspense } from "react";
import { SetPasswordForm } from "./set-password-form";

// SetPasswordForm reads ?token_hash=&type= via useSearchParams, which
// Next.js requires a Suspense boundary for — same pattern as sign-in and
// sign-up's own ?redirect= handling.
export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}

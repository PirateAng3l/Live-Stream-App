import { SetPasswordForm } from "./set-password-form";

// SetPasswordForm now constructs its Supabase client eagerly (a useState
// lazy initializer, not inside an event handler like sign-in/sign-up do) so
// it can await getSession() before the form is submittable — that runs
// during the server render pass too, which would otherwise make this page
// try to statically prerender at build time with no real Supabase env vars
// available yet. Nothing about this page benefits from being static anyway
// (it only ever matters against a live browser session from an email
// link), so force-dynamic just skips that build-time render entirely,
// matching every other Supabase-touching page under /admin.
export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  return <SetPasswordForm />;
}

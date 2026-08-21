import { SetPasswordForm } from "./set-password-form";

// SetPasswordForm constructs its Supabase client eagerly (a useState lazy
// initializer, not inside an event handler like sign-in/sign-up do) so it
// can confirm a session exists before the form is submittable — that runs
// during the server render pass too, which would otherwise make this page
// try to statically prerender at build time with no real Supabase env vars
// available yet. Nothing about this page benefits from being static anyway
// (it only ever matters right after an invite/recovery email link hands
// off a session via the URL fragment), so force-dynamic just skips that
// build-time render entirely, matching every other Supabase-touching page
// under /admin.
export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  return <SetPasswordForm />;
}

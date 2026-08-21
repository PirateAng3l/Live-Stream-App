import { SetPasswordForm } from "./set-password-form";

// SetPasswordForm constructs its Supabase client eagerly (a useState lazy
// initializer, not inside an event handler like sign-in/sign-up do) so it
// can confirm a session exists before the form is submittable — that runs
// during the server render pass too, which would otherwise make this page
// try to statically prerender at build time with no real Supabase env vars
// available yet. Nothing about this page benefits from being static anyway
// (it only ever matters right after /auth/confirm hands off a session),
// so force-dynamic just skips that build-time render entirely, matching
// every other Supabase-touching page under /admin.
export const dynamic = "force-dynamic";

interface SetPasswordPageProps {
  searchParams: { error?: string };
}

export default function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  // /auth/confirm redirects here with ?error=invalid_link when it couldn't
  // exchange the link's code for a session (missing, expired, or already
  // used) — surfacing that immediately avoids a round trip through
  // getSession() just to discover the same thing.
  const initialError = searchParams.error
    ? "This link has expired or was already used. Ask your admin to resend it."
    : undefined;

  return <SetPasswordForm initialError={initialError} />;
}

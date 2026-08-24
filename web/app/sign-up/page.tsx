import { Suspense } from "react";
import { loadAllSchools, type SchoolOption } from "@/lib/admin";
import { isBackendConfigured } from "@/lib/supabase-server";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
  // Fetched here (server-side, same as every other schools list in this
  // app) and passed down to the client-side sign-up form rather than
  // having that form fetch it itself — schools is public-read, but there's
  // no reason to duplicate that query on the client. Fails soft to an
  // empty list rather than taking out the whole sign-up page: a parent can
  // still sign up with no schools picked (see filterByFavouriteSchools) and
  // add favourites later from /account.
  let schools: SchoolOption[] = [];
  if (isBackendConfigured) {
    try {
      schools = await loadAllSchools();
    } catch {
      schools = [];
    }
  }

  return (
    <Suspense>
      <SignUpForm schools={schools} />
    </Suspense>
  );
}

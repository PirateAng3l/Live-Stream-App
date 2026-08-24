import Link from "next/link";
import { BackendNotConfigured, LoadError } from "../_components";
import { loadAllSchools, type SchoolOption } from "@/lib/admin";
import { getCurrentParent } from "@/lib/auth";
import { loadFavouriteSchoolIds } from "@/lib/favourites-server";
import { isBackendConfigured } from "@/lib/supabase-server";
import { FavouriteSchoolsForm } from "./favourite-schools-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!isBackendConfigured) {
    return <BackendNotConfigured />;
  }

  const parent = await getCurrentParent();
  if (!parent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-panel p-6 text-center">
        <p className="text-textsecondary">Sign in to manage your account.</p>
        <Link
          href={`/sign-in?redirect=${encodeURIComponent("/account")}`}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  let schools: SchoolOption[];
  let favouriteSchoolIds: string[];
  try {
    [schools, favouriteSchoolIds] = await Promise.all([loadAllSchools(), loadFavouriteSchoolIds(parent.id)]);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold">Your account</h1>
      <p className="mb-6 text-sm text-textsecondary">{parent.email}</p>

      <h2 className="mb-2 text-lg font-semibold">Your schools</h2>
      <p className="mb-4 text-sm text-textsecondary">
        Pick the schools you support and your schedule will only show their fixtures. Leave everything
        unchecked to see every school&apos;s fixtures instead.
      </p>
      {schools.length === 0 ? (
        <p className="text-sm text-textsecondary">No schools are on the platform yet.</p>
      ) : (
        <FavouriteSchoolsForm schools={schools} favouriteSchoolIds={favouriteSchoolIds} />
      )}
    </div>
  );
}

// A parent who picks schools during sign-up doesn't necessarily have a
// session yet — Supabase's default email-confirmation flow returns no
// session from signUp() until the confirmation link is clicked, and RLS on
// the favourites table needs auth.uid() to write anything. This stashes
// the pick in localStorage so it survives that gap; FavouritesSync (a
// client component mounted in the root layout) applies it the next time
// the parent has an actual session and clears it once written.
//
// Client-only by design (no supabase-server import) so both the sign-up
// form and FavouritesSync — one runs before a session exists, the other
// after — can share it without pulling server-only code into the browser
// bundle.

const STORAGE_KEY = "odl_pending_favourite_schools";

export function readPendingFavouriteSchoolIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writePendingFavouriteSchoolIds(schoolIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    if (schoolIds.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schoolIds));
    }
  } catch {
    // Storage can throw (private browsing, disabled storage) — worst case
    // the parent just sets their schools later from /account instead of
    // having the sign-up pick carry through automatically.
  }
}

export function clearPendingFavouriteSchoolIds(): void {
  writePendingFavouriteSchoolIds([]);
}

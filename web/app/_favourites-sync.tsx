"use client";

import { useEffect } from "react";
import { clearPendingFavouriteSchoolIds, readPendingFavouriteSchoolIds } from "@/lib/favourites-pending";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Applies a school pick stashed at sign-up (lib/favourites-pending.ts) once
 * the parent actually has a session — covers the email-confirmation path,
 * where signUp() returns no session and the pick can't be written yet.
 * Mounted in the root layout only when getCurrentParent() already found a
 * session server-side, so this never runs for a signed-out visitor and
 * never does a pointless auth round-trip for the common case (nothing
 * pending in storage).
 */
export function FavouritesSync() {
  useEffect(() => {
    const pending = readPendingFavouriteSchoolIds();
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const { error } = await supabase
        .from("favourites")
        .insert(pending.map((schoolId) => ({ parent_id: user.id, school_id: schoolId })));
      if (!error) clearPendingFavouriteSchoolIds();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

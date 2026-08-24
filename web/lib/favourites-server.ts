import { createSupabaseServerClient } from "./supabase-server";

/**
 * School-level favourites only (team_id is never written here) — the
 * "which schools does this parent support" feature. Returns [] for a
 * parent with no picks, which lib/fixtures.ts's filterByFavouriteSchools
 * treats as "no filter", not "show nothing".
 */
export async function loadFavouriteSchoolIds(parentId: string): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("favourites")
    .select("school_id")
    .eq("parent_id", parentId)
    .not("school_id", "is", null);
  if (error) throw new Error(`Could not load favourite schools: ${error.message}`);
  return (data ?? []).map((row) => row.school_id as string);
}

/**
 * Replaces a parent's full set of favourite schools with exactly the given
 * list — simpler and safer than diffing inserts/deletes, and cheap enough
 * for a handful of rows. Used by both the sign-up flow (initial pick) and
 * the /account page (editing it later).
 */
export async function setFavouriteSchoolIds(parentId: string, schoolIds: string[]): Promise<void> {
  const supabase = createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("favourites")
    .delete()
    .eq("parent_id", parentId)
    .not("school_id", "is", null);
  if (deleteError) throw new Error(`Could not update favourite schools: ${deleteError.message}`);

  if (schoolIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("favourites")
    .insert(schoolIds.map((schoolId) => ({ parent_id: parentId, school_id: schoolId })));
  if (insertError) throw new Error(`Could not update favourite schools: ${insertError.message}`);
}

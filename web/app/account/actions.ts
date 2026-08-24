"use server";

import { revalidatePath } from "next/cache";
import { getCurrentParent } from "@/lib/auth";
import { setFavouriteSchoolIds } from "@/lib/favourites-server";

export interface ActionState {
  error?: string;
  saved?: boolean;
}

export async function updateFavouriteSchoolsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parent = await getCurrentParent();
  if (!parent) return { error: "Not signed in" };

  const schoolIds = formData.getAll("school_id").map(String);

  try {
    await setFavouriteSchoolIds(parent.id, schoolIds);
  } catch (error) {
    return { error: (error as Error).message };
  }

  revalidatePath("/account");
  revalidatePath("/schedule");
  revalidatePath("/");
  return { saved: true };
}

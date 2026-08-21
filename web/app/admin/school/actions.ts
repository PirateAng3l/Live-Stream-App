"use server";

import { revalidatePath } from "next/cache";
import { resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ActionState {
  error?: string;
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Storage RLS (migration 0006) is the real backstop — every object must
 * live under `<school_id>/...`, checked against current_school_id()/
 * is_platform_admin() the same way every other "own school" write in this
 * project is. schoolId here is still re-derived via resolveSchoolContext
 * (never trusted from the form) for the same defense-in-depth reasoning as
 * every other admin action, and so a school_operator gets a clear error
 * instead of a raw storage-policy rejection.
 *
 * Always uploads to a fixed path (`<school_id>/logo.<ext>`, upsert) rather
 * than a unique filename per upload — re-uploading a logo should just
 * replace it, not accumulate orphaned files, and it means schools.logo_url
 * only ever needs updating when the extension actually changes.
 */
export async function updateSchoolLogoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const schoolId = resolveSchoolContext(staff, String(formData.get("school_id") ?? ""));
  if (!schoolId) return { error: "A school is required" };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload" };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: "Logo must be a PNG, JPEG, or WebP image" };
  if (file.size > MAX_BYTES) return { error: "Logo must be smaller than 5MB" };

  const extension = EXTENSION_BY_TYPE[file.type];
  const path = `${schoolId}/logo.${extension}`;

  const supabase = createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from("school-logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: publicUrlData } = supabase.storage.from("school-logos").getPublicUrl(path);
  // Cache-busted so the new logo shows immediately everywhere it's used
  // (the Android app's own fetch, this admin page's preview) instead of a
  // stale copy sitting in some CDN/HTTP cache under the same URL as before.
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase.from("schools").update({ logo_url: logoUrl }).eq("id", schoolId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/admin/school");
  return {};
}

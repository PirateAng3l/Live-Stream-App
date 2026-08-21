"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSchoolContext } from "@/lib/admin";
import { getCurrentStaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ActionState {
  error?: string;
  success?: string;
}

/**
 * Onboarding a school used to mean a raw SQL insert against `schools` —
 * fine for the handful platform_admin has personally set up so far, a real
 * blocker past that. schools_write_admin (migration 0001) is the actual
 * backstop; the role check here just gets a school_operator a clear error
 * instead of a raw RLS rejection (school_operator never sees the link that
 * leads here, but the route itself isn't otherwise gated).
 */
export async function createSchoolAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };
  if (staff.role !== "platform_admin") return { error: "Only a platform admin can create a school" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "School name is required" };

  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("schools")
    .insert({
      name,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/admin");
  // Straight into the new school's profile page — the natural next step is
  // giving it a logo, and this also confirms the row was actually created.
  redirect(`/admin/school?school=${data.id}`);
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

/**
 * Two-step by design, split across a privilege boundary:
 *
 * 1. The invite-school-operator edge function creates the auth.users
 *    account — the one thing that genuinely requires the service-role key,
 *    which this app never holds (see that function's own README). Called
 *    with this admin's own session token, not a secret this app stores.
 * 2. The elevation to school_operator happens right here, using this
 *    admin's ordinary RLS-bound session — profiles_admin_all (migration
 *    0001) already lets a platform_admin update any profile, so there's no
 *    reason to duplicate that permission check inside the edge function
 *    too. If this second write fails, the invited account just sits at
 *    the default role='parent' until the operation is retried — a
 *    recoverable state, not a broken one.
 */
export async function inviteOperatorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };
  if (staff.role !== "platform_admin") return { error: "Only a platform admin can invite an operator" };

  const schoolId = resolveSchoolContext(staff, String(formData.get("school_id") ?? ""));
  if (!schoolId) return { error: "A school is required" };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "An email address is required" };

  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Not signed in as staff" };

  const functionsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-school-operator`;
  const response = await fetch(functionsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { error: result.error ?? "Could not send the invite" };

  const { error: elevateError } = await supabase
    .from("profiles")
    .update({ role: "school_operator", school_id: schoolId })
    .eq("id", result.user_id);
  if (elevateError) return { error: elevateError.message };

  revalidatePath("/admin/school");
  return { success: `Invite sent to ${email}` };
}

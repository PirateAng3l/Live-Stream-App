"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSchoolContext } from "@/lib/admin";
import { inviteSchoolOperator, setPasswordRedirectUrl } from "@/lib/invite-operator";
import { getCurrentStaffProfile } from "@/lib/staff";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface ActionState {
  error?: string;
  success?: string;
}

/**
 * Spec 4.5's per-school consent flag (migration 0011) — a required
 * attestation before that school can create a new fixture
 * (fixtures_insert_own_school). This only records that the school
 * affirmatively said yes and when/who; it doesn't and can't verify the
 * underlying parental consent process is actually adequate — see the
 * checkbox copy on ConsentForm itself for how that's framed.
 */
export async function confirmSchoolConsentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };

  const schoolId = resolveSchoolContext(staff, String(formData.get("school_id") ?? ""));
  if (!schoolId) return { error: "A school is required" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("schools")
    .update({ consent_confirmed_at: new Date().toISOString(), consent_confirmed_by: staff.id })
    .eq("id", schoolId);
  if (error) return { error: error.message };

  revalidatePath("/admin/school");
  return { success: "Consent confirmed — this school can now create fixtures." };
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
 * The manual per-school fallback — most schools now get invited
 * automatically the moment their sign-up request is approved (see
 * approveSchoolRequestAction, school-requests/actions.ts), which calls the
 * exact same inviteSchoolOperator helper this does. This form stays for a
 * school that was created directly via createSchoolAction (no sign-up
 * request involved), or for re-inviting under a different email address.
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
  const result = await inviteSchoolOperator(supabase, { email, schoolId });
  if (result.error) return { error: result.error };

  revalidatePath("/admin/school");
  return { success: result.success };
}

/**
 * Closes the gap inviteOperatorAction's own README/comment flags: if an
 * invite email is lost or its link expires, re-running inviteOperatorAction
 * against the same address just fails (auth.admin.inviteUserByEmail
 * rejects an email that's already registered, invited or not).
 *
 * Deliberately not the edge function again — this doesn't create anything,
 * so it doesn't need the service-role key. resetPasswordForEmail is a
 * plain (non-admin) Supabase Auth call: it emails a set-password link to
 * *any* existing account regardless of whether they ever confirmed the
 * original invite, using this app's ordinary anon-key session. Also works
 * as a generic "I forgot how to sign in" resend for an operator who's been
 * active for months, not just a freshly invited one.
 *
 * Supabase deliberately doesn't report whether the email actually matched
 * an account (this always "succeeds" to avoid leaking who has one) — the
 * success message reflects that honestly rather than implying a delivery
 * guarantee this call can't actually make.
 */
export async function resendOperatorInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await getCurrentStaffProfile();
  if (!staff) return { error: "Not signed in as staff" };
  if (staff.role !== "platform_admin") return { error: "Only a platform admin can resend a sign-in email" };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "An email address is required" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: setPasswordRedirectUrl(),
  });
  if (error) return { error: error.message };

  return { success: `If ${email} has an account, a sign-in email is on its way.` };
}

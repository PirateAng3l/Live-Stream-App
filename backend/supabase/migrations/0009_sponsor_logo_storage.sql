-- Storage bucket for sponsor logos — same gap 0006's own comment flagged:
-- sponsors.logo_url (migration 0001) has always been a plain text column,
-- but the only way to fill it in was pasting a URL of an image hosted
-- somewhere else, unlike a school's own logo which gets a real upload.
-- This gives sponsors the identical treatment, right down to the RLS
-- shape — same current_school_id()/is_platform_admin() helpers, same
-- "every object must live under `<school_id>/...`" path scoping as
-- school_logos (0006). Objects are named `<school_id>/<sponsor_id>.<ext>`
-- (web/app/admin/sponsors/[id]/edit/actions.ts) — the sponsor's own school,
-- not some other lookup, so the same path check that already works for
-- school logos works here unchanged.
--
-- Public bucket for the same reason school-logos is: a sponsor's logo is
-- non-sensitive branding, already visible to anyone watching the stream
-- (baked_in) or the match page (web_overlay) it's assigned to.

insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do nothing;

create policy sponsor_logos_read_all on storage.objects
  for select using (bucket_id = 'sponsor-logos');

create policy sponsor_logos_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'sponsor-logos'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy sponsor_logos_update_own on storage.objects
  for update to authenticated using (
    bucket_id = 'sponsor-logos'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  ) with check (
    bucket_id = 'sponsor-logos'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy sponsor_logos_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'sponsor-logos'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

-- A platform_admin has no school_id (current_school_id() is null for
-- them), so the "own" policies above never match their uploads — same
-- admin-covers-everything split as school_logos_write_admin (0006).
create policy sponsor_logos_write_admin on storage.objects
  for all to authenticated using (
    bucket_id = 'sponsor-logos' and public.is_platform_admin()
  ) with check (
    bucket_id = 'sponsor-logos' and public.is_platform_admin()
  );

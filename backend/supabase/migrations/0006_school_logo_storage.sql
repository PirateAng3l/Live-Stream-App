-- Storage bucket for school logos (spec: a school's own emblem, shown
-- baked into the Android app's overlay in place of the flat home/away
-- colour block). `schools.logo_url` (migration 0001) already exists as
-- a plain text column — this just gives schools somewhere to actually
-- upload a file to, rather than needing to paste a URL of one hosted
-- elsewhere (the current, more limited approach for sponsor logos).
--
-- Public bucket (logos are non-sensitive branding, already visible to
-- anyone watching a stream) — reads need no auth, same as
-- schools_read_all already allows for the schools table itself. Writes
-- are scoped by path: every object must live under
-- `<school_id>/...`, checked against the same current_school_id()/
-- is_platform_admin() helpers (0001) every other "own school" policy
-- in this project already uses.

insert into storage.buckets (id, name, public)
values ('school-logos', 'school-logos', true)
on conflict (id) do nothing;

create policy school_logos_read_all on storage.objects
  for select using (bucket_id = 'school-logos');

create policy school_logos_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'school-logos'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy school_logos_update_own on storage.objects
  for update to authenticated using (
    bucket_id = 'school-logos'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  ) with check (
    bucket_id = 'school-logos'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy school_logos_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'school-logos'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

-- A platform_admin has no school_id (current_school_id() is null for
-- them), so the "own" policies above never match their uploads — this
-- covers every school for them instead, same split as schools_write_admin.
create policy school_logos_write_admin on storage.objects
  for all to authenticated using (
    bucket_id = 'school-logos' and public.is_platform_admin()
  ) with check (
    bucket_id = 'school-logos' and public.is_platform_admin()
  );

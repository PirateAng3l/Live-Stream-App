-- fixture_sponsors_write_own_school (0001) only ever checked that the
-- FIXTURE belongs to the caller's school. It never checked that the
-- SPONSOR being attached also belongs to that school. Since sponsors is
-- itself keyed by school_id (each school owns and sells its own sponsor
-- inventory, per the licensing model this project settled on), that gap
-- meant a school_operator who somehow obtained another school's sponsor
-- UUID (leaked, guessed, or just enumerated — UUIDs are unguessable but
-- not secret) could attach that sponsor to their own fixture: a cross-
-- tenant data-integrity hole, same shape as the fixture_broadcast_credentials
-- gap fixed in 0003, though lower severity here since nothing secret is
-- exposed — just an unauthorized cross-school association.
--
-- Fix: replace the policy so both `using` (read/update/delete visibility)
-- and `with check` (what a write is allowed to produce) also require the
-- sponsor row to belong to the caller's own school. Platform admins are
-- unaffected — they have their own separate `for all` policy already.

drop policy fixture_sponsors_write_own_school on public.fixture_sponsors;

create policy fixture_sponsors_write_own_school on public.fixture_sponsors
  for all using (
    exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.host_school_id = public.current_school_id()
    )
    and exists (
      select 1 from public.sponsors s
      where s.id = sponsor_id and s.school_id = public.current_school_id()
    )
  )
  with check (
    exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.host_school_id = public.current_school_id()
    )
    and exists (
      select 1 from public.sponsors s
      where s.id = sponsor_id and s.school_id = public.current_school_id()
    )
  );

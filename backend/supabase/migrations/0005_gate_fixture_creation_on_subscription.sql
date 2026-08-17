-- Surfaces + enforces the business decision already locked in (see
-- backend/README.md's subscriptions section): status only ever gates
-- operations, never viewing past replays. "Operations" has meant nothing
-- concrete in RLS until now — this is the first one: creating a new
-- fixture. fixtures_write_own_school (0001) was a single `for all` policy
-- covering insert/update/delete together, so gating it on subscription
-- status would also have blocked a school_operator from updating an
-- existing fixture (e.g. entering a final score) once their subscription
-- lapsed — not what was decided. Split into per-command policies so only
-- INSERT carries the new check.
--
-- A school with no subscriptions row at all (schools are still created by
-- hand — see backend/README.md — and nothing yet guarantees a row exists
-- the moment a school does) is treated as operational rather than blocked:
-- the gate is meant to stop a *lapsed* school from creating fixtures, not
-- to punish an incomplete manual setup step. Hence `not exists (... status
-- in (expired, cancelled))` rather than `exists (... status in (trial,
-- active))` — the two look similar but differ exactly on a missing row.

drop policy fixtures_write_own_school on public.fixtures;

create policy fixtures_insert_own_school on public.fixtures
  for insert with check (
    host_school_id = public.current_school_id()
    and not exists (
      select 1 from public.subscriptions s
      where s.school_id = host_school_id and s.status in ('expired', 'cancelled')
    )
  );

create policy fixtures_update_own_school on public.fixtures
  for update using (host_school_id = public.current_school_id())
  with check (host_school_id = public.current_school_id());

create policy fixtures_delete_own_school on public.fixtures
  for delete using (host_school_id = public.current_school_id());

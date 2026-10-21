-- A fixture's status only ever moves forward through explicit, manual
-- actions today: the Android app's markFixtureLive (fires on a real RTMP
-- connect) and the admin panel's completeFixtureAction (a deliberate
-- concierge action — see its own comment in web/app/admin/fixtures/[id]/
-- actions.ts). Nothing has ever reverted or advanced status automatically,
-- by design, because a dropped connection isn't the same as a final
-- whistle.
--
-- That design left a real gap: if crew never comes back to "Mark
-- completed" (phone died, they forgot, "Just stop streaming" was picked
-- instead of "Mark completed" in the app's own End Stream dialog), or a
-- fixture never goes live at all (a no-show, a technical failure before
-- kickoff), nothing ever moves it off the public site's LIVE or Scheduled
-- badge. In practice a real fixture sat showing LIVE for four days, and
-- another sat Scheduled five days past its kickoff, before anyone noticed
-- — this closes that gap with a scheduled sweep, not a change to what the
-- app/admin panel do themselves.
--
-- Deliberately generous windows (hours/a day, not minutes) so a long match
-- day or a late kickoff is never mistaken for staleness; this is a safety
-- net for the forgotten case, not a replacement for actually pressing End
-- Stream / Mark completed.
create or replace function public.close_out_stale_fixtures()
returns void
language plpgsql
as $$
begin
  -- Genuinely started (status only ever reaches 'live' via a real RTMP
  -- connect) and still 'live' six hours after kickoff — no school fixture
  -- streams that long. Scores are left untouched (null, same as any other
  -- match closed out without a score ever entered) — this only fixes the
  -- status badge lying about what's actually still going on, not the
  -- result.
  update public.fixtures
  set status = 'completed'
  where status = 'live'
    and scheduled_start < now() - interval '6 hours';

  -- Never even reached 'live' a full day after kickoff — almost certainly
  -- never streamed at all, not a match still realistically "upcoming".
  -- Marked cancelled rather than completed, since nothing was ever
  -- actually broadcast: cancelled fixtures already show in neither the
  -- Upcoming nor Completed tab (groupFixturesByTab, web/lib/fixtures.ts),
  -- which is exactly right here — there's nothing to watch, live or
  -- replayed.
  update public.fixtures
  set status = 'cancelled'
  where status = 'scheduled'
    and scheduled_start < now() - interval '24 hours';
end;
$$;

comment on function public.close_out_stale_fixtures() is
  'Closes out fixtures stuck on live/scheduled long past kickoff because no one ever manually completed or cancelled them — scheduled hourly via pg_cron, see the close-out-stale-fixtures job.';

-- No explicit `with schema` — this project's other Supabase-managed
-- extensions (pgcrypto, uuid-ossp) already land in `extensions` by default
-- without one; pg_cron also always creates its own fixed `cron` schema for
-- its job table and functions regardless of where the extension itself is
-- registered.
create extension if not exists pg_cron;

select cron.schedule(
  'close-out-stale-fixtures',
  '0 * * * *', -- hourly, on the hour
  $$select public.close_out_stale_fixtures();$$
);

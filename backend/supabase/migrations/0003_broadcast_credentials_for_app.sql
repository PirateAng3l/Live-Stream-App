-- Two small adjustments needed to let the broadcaster app actually pull a
-- fixture's credentials, discovered while wiring that up:
--
-- 1. fixture_broadcast_credentials never stored the RTMP ingestion address
--    (rtmp://a.rtmp.youtube.com/live2 or whatever Google assigns for that
--    stream) — only the stream key. The app needs both to build the full
--    RTMP URL; the key alone isn't enough.
--
-- 2. The original read policy only let the fixture's specifically
--    *assigned* operator (fixtures.assigned_operator_id) read its
--    credentials. There's no admin panel yet to actually assign an
--    operator to a fixture, so that column is set on essentially nothing —
--    which meant no school_operator could ever read a stream key in
--    practice. Broadened to: any operator belonging to the fixture's host
--    school. Once fixture assignment exists this can be tightened back
--    down without a schema change, just a policy swap.

alter table public.fixture_broadcast_credentials
  add column youtube_ingestion_address text;

create policy broadcast_credentials_own_school_operator on public.fixture_broadcast_credentials
  for select using (
    exists (
      select 1 from public.fixtures f
      where f.id = fixture_id
        and f.host_school_id = public.current_school_id()
    )
  );

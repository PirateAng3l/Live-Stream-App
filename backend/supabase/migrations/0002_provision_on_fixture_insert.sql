-- Wires fixture creation to the provision-fixture-broadcast edge function:
-- any time a row is inserted into fixtures, this fires the function
-- automatically instead of relying on whatever created the fixture (an
-- admin panel, a future API, a one-off SQL insert) to remember to call it.
--
-- Uses pg_net (fire-and-forget async HTTP from Postgres) rather than
-- calling out synchronously inside the trigger — a fixture insert should
-- never be slowed down or fail because YouTube's API is having a bad
-- moment. If provisioning fails, the fixture row still exists with no
-- broadcast credentials yet; retrying is just calling the function again
-- (see the edge function's own README).
--
-- The function URL and service-role key aren't hardcoded here — they're
-- read from Supabase Vault at call time, since a migration file is
-- checked into git and a service-role key never should be. Populate them
-- once per project via:
--   select vault.create_secret('<your-project-ref>.supabase.co/functions/v1/provision-fixture-broadcast', 'provision_fixture_broadcast_url');
--   select vault.create_secret('<your service_role key>', 'service_role_key');
-- Until those exist, the trigger no-ops with a warning rather than
-- failing the fixture insert.

create extension if not exists pg_net;

create or replace function public.trigger_provision_fixture_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  function_url text;
  service_role_key text;
begin
  select decrypted_secret into function_url
    from vault.decrypted_secrets where name = 'provision_fixture_broadcast_url';
  select decrypted_secret into service_role_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if function_url is null or service_role_key is null then
    raise warning
      'provision_fixture_broadcast_url or service_role_key not set in Vault; skipping auto-provisioning for fixture %',
      new.id;
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object('fixture_id', new.id)
  );

  return new;
end;
$$;

create trigger on_fixture_created_provision_broadcast
  after insert on public.fixtures
  for each row execute function public.trigger_provision_fixture_broadcast();

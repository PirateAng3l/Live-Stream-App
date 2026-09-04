-- profiles has never stored an email — the only place it lived was
-- auth.users, which no ordinary (non-service-role) client can query, and
-- there's no RLS policy that could grant that anyway since auth.users
-- isn't a public schema table. That was fine while every profile lookup
-- was "who am I" (lib/staff.ts reads its own session's auth.users row
-- directly), but the new admin directory (/admin/directory) needs to list
-- *other* people's emails — every school operator and every parent — and
-- doing that from a Server Component means either handing it the
-- service-role key (a much bigger privilege to grant a page than it
-- needs) or having the email sit on profiles itself, readable through the
-- RLS this project already has (profiles_admin_all, migration 0001).
-- This is the second option.
alter table public.profiles add column email text;

-- Backfill every existing row. Running as the migration (elevated DB
-- role, not subject to RLS) is what makes this straightforward — a normal
-- client-side query could never join auth.users like this.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Keep it populated for every new signup from here on.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

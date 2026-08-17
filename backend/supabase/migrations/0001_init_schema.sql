-- Initial schema for the Open Door Live backend.
--
-- Design notes (context for future readers, not obvious from the SQL alone):
--
-- * Three account roles: platform_admin (us), school_operator (a school's
--   trained crew/students), parent (public viewers). Public sign-up always
--   creates a 'parent' profile (see handle_new_user below) — elevating an
--   account to school_operator or platform_admin is a deliberate admin
--   action, never something a sign-up form can grant itself.
--
-- * youtube_accounts is a separate table from schools rather than a column
--   on schools, so that "which YouTube account does this school's fixtures
--   provision under" is a lookup, not a hardcoded assumption. Every school
--   defaults to the platform's own account; a school can be pointed at its
--   own account without touching any provisioning code.
--
-- * The YouTube stream key is split out of fixtures into
--   fixture_broadcast_credentials with its own strict RLS. fixtures itself
--   is meant to be publicly readable (that's the whole point of the public
--   schedule/replay site) but a stream key is a live credential — anyone
--   who had it could hijack the broadcast, so it must never be reachable
--   through the same public-read policy as the rest of the fixture.
--
-- * Sponsors belong to a school (sponsors.school_id), not the platform.
--   Under the subscription/licensing model each school sells and manages
--   its own sponsor inventory; the platform doesn't own or resell sponsor
--   slots itself.
--
-- * Subscription status never gates viewing — only whether a school can
--   currently log in / operate / create new fixtures. A lapsed school's
--   past replays stay visible, by deliberate business decision.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.profile_role as enum ('platform_admin', 'school_operator', 'parent');
create type public.youtube_account_owner as enum ('platform', 'school');
create type public.subscription_tier as enum ('standard', 'premium');
create type public.subscription_billing_cycle as enum ('monthly', 'yearly');
create type public.subscription_status as enum ('trial', 'active', 'expired', 'cancelled');
create type public.fixture_status as enum ('scheduled', 'live', 'completed', 'cancelled');
create type public.fixture_operated_by as enum ('school', 'platform_crew');
create type public.sponsor_position as enum ('lower_third', 'bottom_left', 'bottom_right');
create type public.sponsor_tier as enum ('headline', 'supporting');
create type public.sponsor_layer as enum ('baked_in', 'web_overlay');
create type public.notify_channel as enum ('email', 'push');

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  contact_email text,
  contact_phone text,
  consent_notes text,
  created_at timestamptz not null default now()
);

create table public.youtube_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_type public.youtube_account_owner not null,
  school_id uuid references public.schools(id) on delete cascade,
  channel_id text not null,
  oauth_refresh_token text not null,
  connected_at timestamptz not null default now(),
  -- a 'platform' account never has a school_id; a 'school' account always does
  constraint youtube_accounts_owner_shape check (
    (owner_type = 'platform' and school_id is null) or
    (owner_type = 'school' and school_id is not null)
  )
);

-- at most one platform account, and at most one account per school
create unique index youtube_accounts_platform_singleton
  on public.youtube_accounts ((owner_type = 'platform'))
  where owner_type = 'platform';
create unique index youtube_accounts_one_per_school
  on public.youtube_accounts (school_id)
  where owner_type = 'school';

-- schools default to the platform account until explicitly pointed elsewhere
alter table public.schools
  add column youtube_account_id uuid references public.youtube_accounts(id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  tier public.subscription_tier not null default 'standard',
  billing_cycle public.subscription_billing_cycle not null default 'monthly',
  status public.subscription_status not null default 'trial',
  current_period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.profile_role not null default 'parent',
  school_id uuid references public.schools(id) on delete set null,
  trained_operator boolean not null default false,
  created_at timestamptz not null default now(),
  -- only school_operator profiles carry a school_id
  constraint profiles_school_shape check (
    (role = 'school_operator' and school_id is not null) or
    (role <> 'school_operator' and school_id is null)
  )
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  age_group text,
  sport text not null,
  crest_url text,
  created_at timestamptz not null default now()
);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  logo_url text,
  default_position public.sponsor_position not null default 'bottom_right',
  tier public.sponsor_tier not null default 'supporting',
  click_url text,
  created_at timestamptz not null default now()
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  host_school_id uuid not null references public.schools(id) on delete cascade,
  scheduled_start timestamptz not null,
  status public.fixture_status not null default 'scheduled',
  operated_by public.fixture_operated_by not null default 'school',
  assigned_operator_id uuid references public.profiles(id),
  youtube_video_id text,
  final_home_score int,
  final_away_score int,
  created_at timestamptz not null default now()
);

-- Kept separate from fixtures on purpose — see the file header note on why
-- the stream key can't live on the publicly-readable fixtures table.
create table public.fixture_broadcast_credentials (
  fixture_id uuid primary key references public.fixtures(id) on delete cascade,
  youtube_broadcast_id text,
  youtube_stream_key text,
  created_at timestamptz not null default now()
);

create table public.fixture_sponsors (
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  position public.sponsor_position not null,
  tier public.sponsor_tier not null,
  layer public.sponsor_layer not null default 'baked_in',
  primary key (fixture_id, sponsor_id, layer)
);

create table public.notify_subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(id) on delete cascade,
  email text,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  channel public.notify_channel not null default 'email',
  created_at timestamptz not null default now(),
  constraint notify_subscriptions_who check (parent_id is not null or email is not null)
);

create table public.favourites (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favourites_target check (school_id is not null or team_id is not null)
);

-- ---------------------------------------------------------------------------
-- Auto-create a profile (always 'parent') when someone signs up.
-- Elevating to school_operator/platform_admin is a separate admin action.
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helper functions — security definer so they can read profiles even
-- though profiles itself has RLS enabled (avoids recursive policy lookups).
-- ---------------------------------------------------------------------------

create function public.current_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'platform_admin';
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.schools enable row level security;
alter table public.youtube_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.sponsors enable row level security;
alter table public.fixtures enable row level security;
alter table public.fixture_broadcast_credentials enable row level security;
alter table public.fixture_sponsors enable row level security;
alter table public.notify_subscriptions enable row level security;
alter table public.favourites enable row level security;

-- schools: publicly readable (the schedule site needs to list them);
-- writable only by platform admins or that school's own operators.
create policy schools_read_all on public.schools
  for select using (true);
create policy schools_write_admin on public.schools
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy schools_write_own on public.schools
  for update using (id = public.current_school_id())
  with check (id = public.current_school_id());

-- youtube_accounts: never exposed beyond platform admins. Provisioning
-- always happens server-side with the service role, which bypasses RLS.
create policy youtube_accounts_admin_only on public.youtube_accounts
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- subscriptions: a school can see its own billing status; only admins
-- (i.e. your backend, on successful payment) can change it.
create policy subscriptions_read_own on public.subscriptions
  for select using (
    public.is_platform_admin() or school_id = public.current_school_id()
  );
create policy subscriptions_write_admin on public.subscriptions
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- profiles: everyone can read their own; admins can read/manage all.
create policy profiles_read_own on public.profiles
  for select using (id = auth.uid() or public.is_platform_admin());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role());
create policy profiles_admin_all on public.profiles
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- teams: publicly readable; writable by admins or the owning school.
create policy teams_read_all on public.teams
  for select using (true);
create policy teams_write_admin on public.teams
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy teams_write_own_school on public.teams
  for all using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- sponsors: only visible/manageable by admins and the owning school
-- (this is a school's own sales inventory, not public listing data).
create policy sponsors_admin_all on public.sponsors
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy sponsors_own_school on public.sponsors
  for all using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- fixtures: publicly readable (schedule + replays are the product);
-- writable by admins or the host school's operators.
create policy fixtures_read_all on public.fixtures
  for select using (true);
create policy fixtures_write_admin on public.fixtures
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy fixtures_write_own_school on public.fixtures
  for all using (host_school_id = public.current_school_id())
  with check (host_school_id = public.current_school_id());

-- fixture_broadcast_credentials: the sensitive one. Only admins and the
-- specific operator assigned to that fixture can ever read the stream key.
create policy broadcast_credentials_admin on public.fixture_broadcast_credentials
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy broadcast_credentials_assigned_operator on public.fixture_broadcast_credentials
  for select using (
    exists (
      select 1 from public.fixtures f
      where f.id = fixture_id
        and f.assigned_operator_id = auth.uid()
    )
  );

-- fixture_sponsors: publicly readable (it's what renders on the web overlay);
-- writable by admins or the fixture's host school.
create policy fixture_sponsors_read_all on public.fixture_sponsors
  for select using (true);
create policy fixture_sponsors_write_admin on public.fixture_sponsors
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy fixture_sponsors_write_own_school on public.fixture_sponsors
  for all using (
    exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.host_school_id = public.current_school_id()
    )
  )
  with check (
    exists (
      select 1 from public.fixtures f
      where f.id = fixture_id and f.host_school_id = public.current_school_id()
    )
  );

-- notify_subscriptions / favourites: a parent only ever manages their own.
create policy notify_subscriptions_own on public.notify_subscriptions
  for all using (parent_id = auth.uid() or public.is_platform_admin())
  with check (parent_id = auth.uid() or public.is_platform_admin());
create policy favourites_own on public.favourites
  for all using (parent_id = auth.uid() or public.is_platform_admin())
  with check (parent_id = auth.uid() or public.is_platform_admin());

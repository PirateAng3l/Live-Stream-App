-- Spec 4.5's takedown/opt-out process, the intake side: a public form
-- (no account required — a concerned parent may not have one, and
-- shouldn't need to sign up to raise a safeguarding concern) that lands
-- in a queue platform_admin reviews, same public-insert/admin-manage
-- shape as school_signup_requests (migration 0007). fixture_id is
-- optional and set-null on delete rather than required: a reporter often
-- won't know it, and the fixture it names might get deleted (e.g. as a
-- direct response to the report) without that erasing the report itself.
create table public.concern_reports (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references public.fixtures(id) on delete set null,
  reporter_name text,
  reporter_email text not null,
  description text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.concern_reports enable row level security;

create policy concern_reports_insert_public on public.concern_reports
  for insert
  with check (
    status = 'new'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy concern_reports_admin_manage on public.concern_reports
  for all to authenticated using (public.is_platform_admin())
  with check (public.is_platform_admin());

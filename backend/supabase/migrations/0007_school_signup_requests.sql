-- Public "sign up as a school" request queue. A school choosing "School"
-- instead of "Parent" on /sign-up never gets an auth.users account or any
-- elevated role directly — that would mean anyone could self-serve their
-- way into school_operator, the exact thing this table exists to prevent.
-- Instead it's just a row here for platform_admin to review; approving one
-- (web/app/admin/school-requests) creates the real `schools` row the same
-- way /admin/school/new already does (migration unaffected — that stays a
-- second, direct way for platform_admin to onboard a school without a
-- request ever existing).

create table public.school_signup_requests (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  contact_name text,
  contact_email text not null,
  contact_phone text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resulting_school_id uuid references public.schools(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.school_signup_requests enable row level security;

-- Anyone — signed in or not, this is a public form — can submit a request,
-- but only ever as a fresh pending one. The `with check` blocks a tampered
-- client from inserting a row that's already "approved" (with_check runs
-- on the exact row being inserted, so this closes that off at the RLS
-- layer, not just in the form UI).
create policy school_signup_requests_insert_public on public.school_signup_requests
  for insert
  with check (
    status = 'pending'
    and resulting_school_id is null
    and reviewed_by is null
    and reviewed_at is null
  );

-- Reviewing (reading, approving, rejecting) is platform_admin only — a
-- school_operator has no reason to see requests from schools that aren't
-- them yet.
create policy school_signup_requests_admin_manage on public.school_signup_requests
  for all to authenticated using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Spec 4.5 (POPIA & child-safeguarding, PROJECT_SPEC.md): "the software
-- must support consent flags per school/team and access gating." This is
-- that flag for schools — an explicit, timestamped attestation that a
-- school holds appropriate parental/guardian consent to film and
-- broadcast its students, required before that school can create a new
-- fixture. The actual legal sufficiency of a school's consent process is
-- outside what this software can determine — see the spec's own note to
-- engage POPIA expertise before public launch. This just makes "has the
-- school affirmatively said yes" a real, enforced gate instead of an
-- assumption.
--
-- consent_confirmed_by is nullable-on-delete rather than restricted: the
-- staff account that confirmed consent being later removed shouldn't
-- retroactively invalidate the school's own attestation.
alter table public.schools add column consent_confirmed_at timestamptz;
alter table public.schools add column consent_confirmed_by uuid references public.profiles(id) on delete set null;

-- Same split-into-per-command-policies shape as 0005's subscription gate,
-- layered onto the INSERT policy it already modified — a school's
-- subscription can be operational while its consent attestation is still
-- missing, and both must hold for a new fixture to be allowed. Unlike the
-- subscription check (which fails open on a missing row, since every
-- school already existed before subscriptions did), this fails closed on
-- a null consent_confirmed_at — no attestation on file means no new
-- fixtures, full stop, for every school including ones that predate this
-- migration.
drop policy fixtures_insert_own_school on public.fixtures;

create policy fixtures_insert_own_school on public.fixtures
  for insert with check (
    host_school_id = public.current_school_id()
    and not exists (
      select 1 from public.subscriptions s
      where s.school_id = host_school_id and s.status in ('expired', 'cancelled')
    )
    and exists (
      select 1 from public.schools sc
      where sc.id = host_school_id and sc.consent_confirmed_at is not null
    )
  );

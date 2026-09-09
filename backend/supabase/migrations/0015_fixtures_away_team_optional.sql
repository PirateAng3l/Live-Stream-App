-- A Clean Slate/Event fixture (sport = 'other') is a prize-giving, a
-- concert, a one-off broadcast with no opposing school — there's nothing
-- to put in "away team". Every fixture until now still forced picking a
-- second team anyway, since away_team_id was not null with no exception,
-- which meant creating one of these meant grabbing whatever unrelated
-- team happened to exist just to satisfy the form.
--
-- away_team_id becomes genuinely optional, but only for sport = 'other' —
-- every scored sport still requires two real teams, enforced here rather
-- than trusted to the application layer.
alter table public.fixtures alter column away_team_id drop not null;

alter table public.fixtures
  add constraint fixtures_away_team_required_unless_other
  check (away_team_id is not null or sport = 'other');

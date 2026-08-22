-- Optional scoreboard abbreviation for a team, set by the school itself
-- (web/admin/teams's new/edit forms) rather than left entirely to the
-- Android overlay's own auto-shrink/ellipsis (TeamOverlayRenderer's
-- drawFittedName) to decide how a long name like "Revelation High 1st
-- Team" gets cut down for the on-stream scoreboard. Nullable and optional:
-- a team with no short_name set just keeps using its full name, exactly
-- as before this migration.
alter table public.teams add column short_name text;

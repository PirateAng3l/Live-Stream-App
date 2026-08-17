// Pure types, constants, and display logic — no Supabase import, so this is
// safe to import from a Client Component (the assign-sponsor form, the
// new-sponsor form) as well as Server Components. The actual queries live
// in lib/sponsors-server.ts, same split as lib/fixtures.ts (pure) vs
// lib/supabase.ts (I/O).

export const SPONSOR_TIERS = ["headline", "supporting"] as const;
export type SponsorTier = (typeof SPONSOR_TIERS)[number];

export const SPONSOR_POSITIONS = ["lower_third", "bottom_left", "bottom_right"] as const;
export type SponsorPosition = (typeof SPONSOR_POSITIONS)[number];

// baked_in = burned into the video by the broadcaster app (not wired to this
// table yet — see web/README.md); web_overlay = shown around the player on
// this site (also not built yet). fixture_sponsors exists and is writable
// from here regardless, so a school can build up its sponsor placements now
// and both consumers can start reading it whenever they're built.
export const SPONSOR_LAYERS = ["baked_in", "web_overlay"] as const;
export type SponsorLayer = (typeof SPONSOR_LAYERS)[number];

export function sponsorTierLabel(tier: string): string {
  return tier === "headline" ? "Headline" : "Supporting";
}

export function sponsorPositionLabel(position: string): string {
  switch (position) {
    case "lower_third":
      return "Lower third";
    case "bottom_left":
      return "Bottom left";
    case "bottom_right":
      return "Bottom right";
    default:
      return position;
  }
}

export function sponsorLayerLabel(layer: string): string {
  return layer === "baked_in" ? "Baked into video" : "Web overlay only";
}

export interface SponsorOption {
  id: string;
  name: string;
  tier: SponsorTier;
  defaultPosition: SponsorPosition;
  clickUrl: string | null;
  logoUrl: string | null;
}

export interface FixtureSponsorAssignment {
  sponsorId: string;
  sponsorName: string;
  logoUrl: string | null;
  clickUrl: string | null;
  position: SponsorPosition;
  tier: SponsorTier;
  layer: SponsorLayer;
}

/**
 * Only the `web_overlay` layer belongs on this site — `baked_in` is the
 * broadcaster app's territory (not wired to this table yet, see
 * web/README.md), and showing it here too would double it up once that
 * wiring exists.
 */
export function webOverlaySponsors<T extends { layer: SponsorLayer }>(assignments: T[]): T[] {
  return assignments.filter((assignment) => assignment.layer === "web_overlay");
}

/** Buckets sponsors by their placement slot, preserving assignment order within each. */
export function groupByPosition<T extends { position: SponsorPosition }>(
  sponsors: T[],
): Record<SponsorPosition, T[]> {
  const grouped: Record<SponsorPosition, T[]> = {
    lower_third: [],
    bottom_left: [],
    bottom_right: [],
  };
  for (const sponsor of sponsors) {
    grouped[sponsor.position].push(sponsor);
  }
  return grouped;
}


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
  position: SponsorPosition;
  tier: SponsorTier;
  layer: SponsorLayer;
}


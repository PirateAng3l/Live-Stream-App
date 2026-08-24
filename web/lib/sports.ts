// Keep these values in sync with the Sport enum in the Android app
// (app/src/main/java/com/opendoorproductions/broadcaster/Sport.kt). The
// app matches a fixture's `sport` string against that enum's names
// case-insensitively when a crew member loads a fixture, so a sport
// created here needs to spell the same way for the right scoreboard
// layout (e.g. cricket's very different overlay) to come up automatically.
export const SPORTS = ["rugby", "soccer", "netball", "hockey", "tennis", "cricket", "other"] as const;

export type SportOption = (typeof SPORTS)[number];

export function sportLabel(sport: string): string {
  if (sport === "other") return "Clean Slate / Event";
  return sport.length > 0 ? sport.charAt(0).toUpperCase() + sport.slice(1) : sport;
}

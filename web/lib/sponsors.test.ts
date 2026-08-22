import { describe, expect, it } from "vitest";
import { groupByPosition, webOverlaySponsors } from "./sponsors";

describe("webOverlaySponsors", () => {
  it("keeps only web_overlay assignments, dropping baked_in ones", () => {
    const assignments = [
      { id: "a", layer: "web_overlay" as const },
      { id: "b", layer: "baked_in" as const },
      { id: "c", layer: "web_overlay" as const },
    ];
    expect(webOverlaySponsors(assignments).map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("returns an empty array when nothing is web_overlay", () => {
    expect(webOverlaySponsors([{ id: "a", layer: "baked_in" as const }])).toEqual([]);
  });
});

describe("groupByPosition", () => {
  it("buckets sponsors by position and preserves order within a bucket", () => {
    const sponsors = [
      { id: "a", position: "bottom_left" as const },
      { id: "b", position: "lower_third" as const },
      { id: "c", position: "bottom_left" as const },
    ];
    const grouped = groupByPosition(sponsors);
    expect(grouped.bottom_left.map((s) => s.id)).toEqual(["a", "c"]);
    expect(grouped.lower_third.map((s) => s.id)).toEqual(["b"]);
    expect(grouped.bottom_right).toEqual([]);
  });

  it("returns all four position keys even when empty", () => {
    const grouped = groupByPosition([]);
    expect(Object.keys(grouped).sort()).toEqual(["bottom_left", "bottom_right", "lower_third", "top_right"]);
  });
});

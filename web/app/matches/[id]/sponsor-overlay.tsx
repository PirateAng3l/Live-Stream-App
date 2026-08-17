import type { FixtureSponsorAssignment, SponsorPosition } from "@/lib/sponsors";
import { groupByPosition, webOverlaySponsors } from "@/lib/sponsors";

const POSITION_CLASSES: Record<SponsorPosition, string> = {
  lower_third:
    "absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-4 bg-black/60 px-3 py-2",
  bottom_left: "absolute bottom-2 left-2 flex flex-col items-start gap-2",
  bottom_right: "absolute bottom-2 right-2 flex flex-col items-end gap-2",
};

/**
 * Sits absolutely-positioned over the video container (spec 7.3.3's
 * "web-layer sponsor slots"). Only the `web_overlay` layer belongs here —
 * `baked_in` sponsors are the broadcaster app's job, not this page's, and
 * showing both would double them up once the app is wired to this table
 * too. Reuses the same three position slots (lower_third/bottom_left/
 * bottom_right) as the app's overlay so the vocabulary stays one thing
 * across both surfaces, even though the actual rendering here is just
 * absolutely-positioned HTML over an iframe, nothing baked into any video.
 */
export function SponsorOverlay({ assignments }: { assignments: FixtureSponsorAssignment[] }) {
  const grouped = groupByPosition(webOverlaySponsors(assignments));
  const positions = Object.keys(grouped) as SponsorPosition[];

  return (
    <>
      {positions.map((position) =>
        grouped[position].length === 0 ? null : (
          <div key={position} className={POSITION_CLASSES[position]}>
            {grouped[position].map((sponsor) => (
              <SponsorBadge key={sponsor.sponsorId} sponsor={sponsor} />
            ))}
          </div>
        ),
      )}
    </>
  );
}

function SponsorBadge({ sponsor }: { sponsor: FixtureSponsorAssignment }) {
  // Plain <img>, not next/image: sponsor logos are arbitrary external URLs
  // a school pastes in, and next/image needs each source domain
  // allow-listed ahead of time — not worth it for an optional badge.
  const content = sponsor.logoUrl ? (
    <img src={sponsor.logoUrl} alt={sponsor.sponsorName} className="h-8 max-w-[120px] object-contain" />
  ) : (
    <span className="rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">{sponsor.sponsorName}</span>
  );

  if (!sponsor.clickUrl) return content;

  return (
    <a href={sponsor.clickUrl} target="_blank" rel="noopener noreferrer sponsored" title={sponsor.sponsorName}>
      {content}
    </a>
  );
}

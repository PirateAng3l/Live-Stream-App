import Link from "next/link";
import { notFound } from "next/navigation";
import { BackendNotConfigured, LoadError, StatusBadge } from "../../_components";
import { getCurrentParent } from "@/lib/auth";
import { formatKickoff } from "@/lib/fixtures";
import type { FixtureSponsorAssignment } from "@/lib/sponsors";
import { loadFixtureSponsors } from "@/lib/sponsors-server";
import { isBackendConfigured, loadFixtureById } from "@/lib/supabase";
import { SponsorOverlay } from "./sponsor-overlay";

export const dynamic = "force-dynamic";

interface MatchPageProps {
  params: { id: string };
}

export default async function MatchPage({ params }: MatchPageProps) {
  if (!isBackendConfigured) {
    return <BackendNotConfigured />;
  }

  let fixture;
  try {
    fixture = await loadFixtureById(params.id);
  } catch (error) {
    return <LoadError message={(error as Error).message} />;
  }

  if (!fixture) notFound();

  const hasFinalScore = fixture.status === "completed" &&
    fixture.finalHomeScore !== null &&
    fixture.finalAwayScore !== null;

  // Spec 4.4/7.3.3: viewing the actual footage is gated behind a signed-in
  // account; browsing the schedule and a match's basic info (teams, time,
  // final score) is not. That split is deliberate — the sensitive part is
  // watching children on video, not knowing a match happened, and keeping
  // metadata public is what makes the schedule shareable at all.
  const parent = await getCurrentParent();

  // Sponsor badges are decorative, not the reason anyone's on this page —
  // a failure loading them shouldn't take out the match/video itself, so
  // this fails soft to an empty overlay instead of LoadError-ing the page.
  let sponsorAssignments: FixtureSponsorAssignment[] = [];
  try {
    sponsorAssignments = await loadFixtureSponsors(fixture.id);
  } catch {
    sponsorAssignments = [];
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-textsecondary">
        {fixture.sport} · {fixture.schoolName}
      </p>
      <div className="mt-1 flex items-center gap-3">
        <h1 className="text-2xl font-bold">
          {fixture.homeTeamName} <span className="text-textsecondary">vs</span> {fixture.awayTeamName}
        </h1>
        <StatusBadge status={fixture.status} />
      </div>
      <p className="mt-1 text-sm text-textsecondary">{formatKickoff(fixture.scheduledStart)}</p>

      <div className="relative mt-6">
        {fixture.hiddenFromViewers ? (
          // Spec 4.5's takedown lever (migration 0012) — checked ahead of
          // sign-in state entirely, since a taken-down video should stay
          // down for everyone, not just show a normal sign-in prompt.
          <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-white/10 bg-panel p-6 text-center text-textsecondary">
            <p>This video has been taken down and is no longer available.</p>
          </div>
        ) : fixture.youtubeVideoId ? (
          parent ? (
            // Not an embedded iframe: YouTube's `embeddable` flag turned out
            // to be a known, longstanding gap in the Data API — videos.update
            // reports success but the flag doesn't actually take effect (see
            // provision-fixture-broadcast's own comment), so an in-page
            // embed just shows YouTube's "disabled by the video owner"
            // error for anyone who isn't the channel owner. Direct YouTube
            // playback has worked in every test regardless, so this links
            // straight to the watch page instead — same login gate (still
            // has to be a signed-in parent to see this button at all), just
            // the actual playback happens on YouTube's own page rather than
            // inline here. Same video ID serves both the live stream and,
            // once it ends, the replay (spec 9.7), so this needs no "is it
            // live or a replay" branch either.
            <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-lg border border-white/10 bg-panel p-6 text-center">
              <p className="text-textsecondary">
                {fixture.status === "live"
                  ? "This match is streaming live now."
                  : fixture.status === "completed"
                    ? "Watch the replay on YouTube."
                    : "The stream will play on YouTube once it goes live."}
              </p>
              <a
                href={`https://www.youtube.com/watch?v=${fixture.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white"
              >
                {fixture.status === "live" ? "Watch live on YouTube" : "Watch on YouTube"}
              </a>
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-panel p-6 text-center">
              <p className="text-textsecondary">Sign in to watch this match.</p>
              <Link
                href={`/sign-in?redirect=${encodeURIComponent(`/matches/${fixture.id}`)}`}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            </div>
          )
        ) : (
          <div className="rounded-lg border border-white/10 bg-panel p-6 text-textsecondary">
            {fixture.status === "scheduled"
              ? "Stream not started yet — check back closer to kickoff."
              : "No video available for this fixture yet."}
          </div>
        )}
        {/* Only over the aspect-video-sized states above — the "no video
            yet" and taken-down boxes are a different shape (or shouldn't
            carry sponsor branding at all, in the taken-down case) and
            sponsors placed on them would just look wrong. */}
        {fixture.youtubeVideoId && !fixture.hiddenFromViewers && <SponsorOverlay assignments={sponsorAssignments} />}
      </div>

      {hasFinalScore && (
        <p className="mt-4 text-lg font-semibold">
          Final score: {fixture.homeTeamName} {fixture.finalHomeScore} – {fixture.finalAwayScore}{" "}
          {fixture.awayTeamName}
        </p>
      )}

      {!fixture.hiddenFromViewers && (
        <p className="mt-6 text-xs text-textsecondary">
          Concerned about this video?{" "}
          <Link href={`/report-concern?fixture=${fixture.id}`} className="text-accent hover:underline">
            Report a concern
          </Link>
          .
        </p>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { BackendNotConfigured, LoadError } from "../../_components";
import { getCurrentParent } from "@/lib/auth";
import { formatKickoff } from "@/lib/fixtures";
import { isBackendConfigured, loadFixtureById } from "@/lib/supabase";

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

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-textsecondary">
        {fixture.sport} · {fixture.schoolName}
      </p>
      <h1 className="mt-1 text-2xl font-bold">
        {fixture.homeTeamName} <span className="text-textsecondary">vs</span> {fixture.awayTeamName}
      </h1>
      <p className="mt-1 text-sm text-textsecondary">{formatKickoff(fixture.scheduledStart)}</p>

      <div className="mt-6">
        {fixture.youtubeVideoId ? (
          parent ? (
            // Same video ID serves both the live stream and, once it ends,
            // the replay — that's how YouTube Live broadcasts work (spec
            // 9.7), so this embed needs no "is it live or a replay" branch.
            <div className="aspect-video overflow-hidden rounded-lg border border-white/10">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${fixture.youtubeVideoId}`}
                title={`${fixture.homeTeamName} vs ${fixture.awayTeamName}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
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
      </div>

      {hasFinalScore && (
        <p className="mt-4 text-lg font-semibold">
          Final score: {fixture.homeTeamName} {fixture.finalHomeScore} – {fixture.finalAwayScore}{" "}
          {fixture.awayTeamName}
        </p>
      )}
    </div>
  );
}

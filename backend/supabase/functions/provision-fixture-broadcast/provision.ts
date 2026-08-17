// Orchestrates provisioning a YouTube broadcast for one fixture:
// look up which YouTube account it should provision under -> refresh that
// account's access token -> create the broadcast -> create a stream ->
// bind them -> persist the results.
//
// All I/O (database reads/writes, HTTP) is passed in rather than reached
// for globally, so this can be fully unit-tested without a live Supabase
// project or real Google credentials — see provision.test.ts.

import {
  bindBroadcastToStream,
  createLiveBroadcast,
  createLiveStream,
  refreshAccessToken,
} from "./youtube.ts";

export interface FixtureForProvisioning {
  id: string;
  sport: string;
  scheduledStart: string; // ISO 8601
  hostSchoolId: string;
  homeTeamName: string;
  awayTeamName: string;
}

export interface YoutubeAccount {
  id: string;
  channelId: string;
  oauthRefreshToken: string;
}

export interface ProvisionDb {
  getFixture(fixtureId: string): Promise<FixtureForProvisioning>;
  /** Resolves to the school's own YouTube account if it has one, else the platform's. */
  getYoutubeAccountForSchool(schoolId: string): Promise<YoutubeAccount>;
  saveBroadcastCredentials(
    fixtureId: string,
    credentials: {
      broadcastId: string;
      streamKey: string;
      ingestionAddress: string;
    },
  ): Promise<void>;
  setFixtureVideoId(fixtureId: string, videoId: string): Promise<void>;
}

export interface ProvisionDeps {
  db: ProvisionDb;
  fetchFn: typeof fetch;
  googleClientId: string;
  googleClientSecret: string;
}

export interface ProvisionResult {
  fixtureId: string;
  videoId: string;
  ingestionAddress: string;
  streamKey: string;
}

function broadcastTitle(fixture: FixtureForProvisioning): string {
  return `${fixture.homeTeamName} vs ${fixture.awayTeamName} (${fixture.sport})`;
}

export async function provisionFixtureBroadcast(
  fixtureId: string,
  deps: ProvisionDeps,
): Promise<ProvisionResult> {
  const fixture = await deps.db.getFixture(fixtureId);
  const account = await deps.db.getYoutubeAccountForSchool(
    fixture.hostSchoolId,
  );

  const token = await refreshAccessToken(deps.fetchFn, {
    clientId: deps.googleClientId,
    clientSecret: deps.googleClientSecret,
    refreshToken: account.oauthRefreshToken,
  });

  const title = broadcastTitle(fixture);

  const broadcast = await createLiveBroadcast(deps.fetchFn, {
    accessToken: token.access_token,
    title,
    description:
      `Live stream of ${title}, scheduled ${fixture.scheduledStart}.`,
    scheduledStartTime: fixture.scheduledStart,
  });

  // A fresh stream per fixture, never reused — see the comment on
  // createLiveStream for why (concurrent fixtures must never share a key).
  const stream = await createLiveStream(deps.fetchFn, {
    accessToken: token.access_token,
    title,
  });

  await bindBroadcastToStream(deps.fetchFn, {
    accessToken: token.access_token,
    broadcastId: broadcast.id,
    streamId: stream.id,
  });

  await deps.db.saveBroadcastCredentials(fixtureId, {
    broadcastId: broadcast.id,
    streamKey: stream.streamName,
    ingestionAddress: stream.ingestionAddress,
  });
  await deps.db.setFixtureVideoId(fixtureId, broadcast.id);

  return {
    fixtureId,
    videoId: broadcast.id,
    ingestionAddress: stream.ingestionAddress,
    streamKey: stream.streamName,
  };
}

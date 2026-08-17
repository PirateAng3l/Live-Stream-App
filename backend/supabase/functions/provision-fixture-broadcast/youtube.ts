// Thin, typed wrapper around the three YouTube Live API calls needed to turn
// a fixture into a streamable broadcast: create the event (liveBroadcast),
// create the ingest point (liveStream), and bind them together.
//
// Every function here takes `fetchFn` as a parameter instead of calling the
// global `fetch` directly, so tests can substitute a fake implementation and
// assert on exactly what was sent — without ever making a real network call
// or needing real Google credentials.

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface LiveBroadcastResult {
  /** Same value doubles as the YouTube video ID (a liveBroadcast IS a video resource). */
  id: string;
}

export interface LiveStreamResult {
  id: string;
  ingestionAddress: string;
  streamName: string;
}

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

type FetchFn = typeof fetch;

interface GoogleErrorBody {
  error?: { message?: string };
}

async function parseOrThrow<T>(response: Response, action: string): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as GoogleErrorBody | null)?.error?.message ??
      response.statusText;
    throw new Error(
      `YouTube API error during ${action} (${response.status}): ${message}`,
    );
  }
  return body as T;
}

/** Exchanges a stored refresh token for a short-lived access token. */
export async function refreshAccessToken(
  fetchFn: FetchFn,
  params: { clientId: string; clientSecret: string; refreshToken: string },
): Promise<GoogleTokenResponse> {
  const response = await fetchFn(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  return parseOrThrow<GoogleTokenResponse>(response, "token refresh");
}

/**
 * Creates the scheduled broadcast (the "event"). Privacy is hardcoded to
 * unlisted per the spec's viewing-access decision (4.4) — this is not
 * meant to be a public YouTube-search-discoverable video.
 */
export async function createLiveBroadcast(
  fetchFn: FetchFn,
  params: {
    accessToken: string;
    title: string;
    description: string;
    scheduledStartTime: string;
  },
): Promise<LiveBroadcastResult> {
  const response = await fetchFn(
    `${YOUTUBE_API_BASE}/liveBroadcasts?part=snippet,status,contentDetails`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          title: params.title,
          description: params.description,
          scheduledStartTime: params.scheduledStartTime,
        },
        status: { privacyStatus: "unlisted" },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
        },
      }),
    },
  );
  const body = await parseOrThrow<{ id: string }>(
    response,
    "liveBroadcasts.insert",
  );
  return { id: body.id };
}

/**
 * Creates a fresh ingest point for this fixture. Deliberately never reused
 * across fixtures — two fixtures streaming at the same moment must never
 * share a stream key (see backend/README.md concurrency note), and a fresh
 * liveStream per fixture makes that a non-issue by construction rather than
 * something that has to be tracked and enforced elsewhere.
 */
export async function createLiveStream(
  fetchFn: FetchFn,
  params: { accessToken: string; title: string },
): Promise<LiveStreamResult> {
  const response = await fetchFn(
    `${YOUTUBE_API_BASE}/liveStreams?part=snippet,cdn`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: { title: params.title },
        cdn: {
          frameRate: "variable",
          ingestionType: "rtmp",
          resolution: "variable",
        },
      }),
    },
  );
  interface RawLiveStreamResponse {
    id: string;
    cdn: { ingestionInfo: { ingestionAddress: string; streamName: string } };
  }
  const body = await parseOrThrow<RawLiveStreamResponse>(
    response,
    "liveStreams.insert",
  );
  return {
    id: body.id,
    ingestionAddress: body.cdn.ingestionInfo.ingestionAddress,
    streamName: body.cdn.ingestionInfo.streamName,
  };
}

/** Connects the ingest point to the event so RTMP pushed into it goes live on that broadcast. */
export async function bindBroadcastToStream(
  fetchFn: FetchFn,
  params: { accessToken: string; broadcastId: string; streamId: string },
): Promise<void> {
  const response = await fetchFn(
    `${YOUTUBE_API_BASE}/liveBroadcasts/bind?id=${
      encodeURIComponent(params.broadcastId)
    }` +
      `&part=id,contentDetails&streamId=${encodeURIComponent(params.streamId)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${params.accessToken}` },
    },
  );
  await parseOrThrow<unknown>(response, "liveBroadcasts.bind");
}

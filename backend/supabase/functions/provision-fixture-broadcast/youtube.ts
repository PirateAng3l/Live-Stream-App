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
 * public — a deliberate reversal of the original `unlisted`/search-hidden
 * decision (spec 4.4), made explicitly for channel growth, sponsor
 * visibility, and giving prospective schools something real to see before
 * signing up. Viewing on this site is still login-gated regardless
 * (`/matches/[id]`); this only affects whether the video is independently
 * discoverable via YouTube's own search/browse/recommendations, which it
 * now is.
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
        status: { privacyStatus: "public" },
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

/**
 * A liveBroadcast's `status` part has no `embeddable` field — that field
 * only exists on the `videos` resource. Since a liveBroadcast IS a video
 * resource under the same ID, this is a `videos.update` call on that same
 * ID rather than anything in the liveBroadcasts.insert call above. Without
 * it, a broadcast created via the API defaults to non-embeddable, which is
 * exactly why `/matches/[id]`'s YouTube iframe showed "Playback on other
 * websites has been disabled by the video owner" on a live match that
 * played fine directly on YouTube — nothing here was ever setting this.
 *
 * `videos.update` replaces the whole `status` part, so privacyStatus has
 * to be repeated here or it would silently reset away from whatever
 * createLiveBroadcast set (public) back to PostgREST's/YouTube's own
 * update-time default — this call's whole purpose is additive
 * (embeddable), never a chance to quietly re-narrow visibility.
 */
export async function setVideoEmbeddable(
  fetchFn: FetchFn,
  params: { accessToken: string; videoId: string },
): Promise<void> {
  const response = await fetchFn(
    `${YOUTUBE_API_BASE}/videos?part=status`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: params.videoId,
        status: { privacyStatus: "public", embeddable: true },
      }),
    },
  );
  await parseOrThrow<unknown>(response, "videos.update");

  // A 200 OK here turned out not to be enough evidence that embeddable
  // actually stuck — a fixture provisioned after this call went out still
  // showed the "disabled by the video owner" embed error days later, in
  // both a signed-out Incognito window and a signed-in account, which
  // rules out a per-viewer restriction. Rather than guess further, read
  // the flag straight back and log clearly if it didn't take, so the next
  // real provisioning run leaves a direct answer in this function's own
  // logs instead of more inference from browser behavior.
  await verifyVideoEmbeddable(fetchFn, params);
}

interface VideosListResponse {
  items?: { status?: { embeddable?: boolean } }[];
}

async function verifyVideoEmbeddable(
  fetchFn: FetchFn,
  params: { accessToken: string; videoId: string },
): Promise<void> {
  try {
    const response = await fetchFn(
      `${YOUTUBE_API_BASE}/videos?part=status&id=${
        encodeURIComponent(params.videoId)
      }`,
      { headers: { Authorization: `Bearer ${params.accessToken}` } },
    );
    const body = await parseOrThrow<VideosListResponse>(
      response,
      "videos.list (embeddable verification)",
    );
    const embeddable = body.items?.[0]?.status?.embeddable;
    if (embeddable !== true) {
      console.warn(
        `setVideoEmbeddable: videos.update reported success for ${params.videoId}, ` +
          `but a follow-up videos.list still shows embeddable=${embeddable}. This ` +
          "points to a channel-level restriction (e.g. the channel isn't phone-" +
          "verified for embedding, or another YouTube eligibility requirement) " +
          "rather than a bug in the update call itself — check the channel's own " +
          "verification/embedding settings in YouTube Studio.",
      );
    }
  } catch (error) {
    // Best-effort: this is a diagnostic check, not part of what
    // provisioning actually needs to succeed — the update call above
    // already got its own 200 OK. A failure here just means this
    // particular run has no extra confirmation either way.
    console.warn(
      `setVideoEmbeddable: could not verify embeddable status for ${params.videoId}`,
      error,
    );
  }
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

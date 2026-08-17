import { strict as assert } from "node:assert";
import {
  bindBroadcastToStream,
  createLiveBroadcast,
  createLiveStream,
  refreshAccessToken,
} from "./youtube.ts";

/** Records every call made through it and replays a canned response. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: url.toString(), init: init ?? {} });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fn, calls };
}

Deno.test("refreshAccessToken posts client credentials + refresh token as form data", async () => {
  const { fn, calls } = fakeFetch(200, {
    access_token: "at-123",
    expires_in: 3600,
    scope: "youtube",
    token_type: "Bearer",
  });

  const result = await refreshAccessToken(fn, {
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
  });

  assert.equal(result.access_token, "at-123");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(calls[0].init.method, "POST");
  const sentBody = (calls[0].init.body as URLSearchParams).toString();
  assert.ok(sentBody.includes("refresh_token=refresh-token"));
  assert.ok(sentBody.includes("grant_type=refresh_token"));
});

Deno.test("createLiveBroadcast sends unlisted privacy + auto start/stop", async () => {
  const { fn, calls } = fakeFetch(200, { id: "bcast-1" });

  const result = await createLiveBroadcast(fn, {
    accessToken: "at-123",
    title: "Home vs Away (rugby)",
    description: "desc",
    scheduledStartTime: "2026-08-20T14:00:00Z",
  });

  assert.equal(result.id, "bcast-1");
  const sent = JSON.parse(calls[0].init.body as string);
  assert.equal(sent.status.privacyStatus, "unlisted");
  assert.equal(sent.contentDetails.enableAutoStart, true);
  assert.equal(sent.contentDetails.enableAutoStop, true);
  assert.equal(sent.snippet.scheduledStartTime, "2026-08-20T14:00:00Z");
  assert.ok(calls[0].url.includes("/liveBroadcasts?"));
  assert.equal(
    (calls[0].init.headers as Record<string, string>)["Authorization"],
    "Bearer at-123",
  );
});

Deno.test("createLiveStream extracts ingestion address + stream key from cdn.ingestionInfo", async () => {
  const { fn } = fakeFetch(200, {
    id: "stream-1",
    cdn: {
      ingestionInfo: {
        ingestionAddress: "rtmp://a.rtmp.youtube.com/live2",
        streamName: "abcd-1234-efgh-5678",
      },
    },
  });

  const result = await createLiveStream(fn, {
    accessToken: "at-123",
    title: "Home vs Away",
  });

  assert.equal(result.id, "stream-1");
  assert.equal(result.ingestionAddress, "rtmp://a.rtmp.youtube.com/live2");
  assert.equal(result.streamName, "abcd-1234-efgh-5678");
});

Deno.test("bindBroadcastToStream puts both IDs in the query string", async () => {
  const { fn, calls } = fakeFetch(200, { id: "bcast-1" });

  await bindBroadcastToStream(fn, {
    accessToken: "at-123",
    broadcastId: "bcast-1",
    streamId: "stream-1",
  });

  assert.ok(calls[0].url.includes("id=bcast-1"));
  assert.ok(calls[0].url.includes("streamId=stream-1"));
});

Deno.test("a non-ok response throws with the Google error message, not a silent failure", async () => {
  const { fn } = fakeFetch(403, { error: { message: "quotaExceeded" } });

  await assert.rejects(
    () =>
      createLiveBroadcast(fn, {
        accessToken: "at-123",
        title: "t",
        description: "d",
        scheduledStartTime: "2026-08-20T14:00:00Z",
      }),
    /quotaExceeded/,
  );
});

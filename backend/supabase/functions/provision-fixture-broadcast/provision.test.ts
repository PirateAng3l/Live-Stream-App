// deno.json in this folder excludes the require-await lint rule: the fakes
// below implement ProvisionDb's async-returning interface with values that
// are already available, so there's nothing to await — that's fine for a
// mock, unlike in real code where it'd be worth asking why.

import { strict as assert } from "node:assert";
import type {
  FixtureForProvisioning,
  ProvisionDb,
  YoutubeAccount,
} from "./provision.ts";
import { provisionFixtureBroadcast } from "./provision.ts";

const FIXTURE: FixtureForProvisioning = {
  id: "fixture-1",
  sport: "rugby",
  scheduledStart: "2026-08-20T14:00:00Z",
  hostSchoolId: "school-1",
  homeTeamName: "Riverside 1st XV",
  awayTeamName: "Oak Park 1st XV",
};

const ACCOUNT: YoutubeAccount = {
  id: "yt-account-1",
  channelId: "UC_platform",
  oauthRefreshToken: "refresh-token-abc",
};

/** A fake ProvisionDb that records every write so tests can assert on them. */
function fakeDb(overrides: Partial<ProvisionDb> = {}) {
  const savedCredentials: unknown[] = [];
  const savedVideoIds: unknown[] = [];
  const db: ProvisionDb = {
    getFixture: async () => FIXTURE,
    getYoutubeAccountForSchool: async () => ACCOUNT,
    saveBroadcastCredentials: async (fixtureId, credentials) => {
      savedCredentials.push({ fixtureId, credentials });
    },
    setFixtureVideoId: async (fixtureId, videoId) => {
      savedVideoIds.push({ fixtureId, videoId });
    },
    ...overrides,
  };
  return { db, savedCredentials, savedVideoIds };
}

/** Routes a fake fetch by URL so it can play all 4 real HTTP calls in one test. */
function fakeGoogleApi() {
  const calls: string[] = [];
  const fn = (async (url: string | URL) => {
    const u = url.toString();
    calls.push(u);
    if (u.includes("oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({ access_token: "at-123", expires_in: 3600 }),
        {
          status: 200,
        },
      );
    }
    if (u.includes("/liveBroadcasts/bind")) {
      return new Response(JSON.stringify({ id: "bcast-1" }), { status: 200 });
    }
    if (u.includes("/liveBroadcasts")) {
      return new Response(JSON.stringify({ id: "bcast-1" }), { status: 200 });
    }
    if (u.includes("/liveStreams")) {
      return new Response(
        JSON.stringify({
          id: "stream-1",
          cdn: {
            ingestionInfo: {
              ingestionAddress: "rtmp://a.rtmp.youtube.com/live2",
              streamName: "the-stream-key",
            },
          },
        }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected URL in test: ${u}`);
  }) as typeof fetch;
  return { fn, calls };
}

Deno.test("provisionFixtureBroadcast runs the full flow and persists the result", async () => {
  const { db, savedCredentials, savedVideoIds } = fakeDb();
  const { fn, calls } = fakeGoogleApi();

  const result = await provisionFixtureBroadcast("fixture-1", {
    db,
    fetchFn: fn,
    googleClientId: "client-id",
    googleClientSecret: "client-secret",
  });

  assert.deepEqual(result, {
    fixtureId: "fixture-1",
    videoId: "bcast-1",
    ingestionAddress: "rtmp://a.rtmp.youtube.com/live2",
    streamKey: "the-stream-key",
  });

  // token refresh -> create broadcast -> create stream -> bind, in that order
  assert.deepEqual(calls.length, 4);
  assert.deepEqual(calls[0].includes("oauth2.googleapis.com/token"), true);
  assert.deepEqual(calls[1].includes("/liveBroadcasts?"), true);
  assert.deepEqual(calls[2].includes("/liveStreams"), true);
  assert.deepEqual(calls[3].includes("/liveBroadcasts/bind"), true);

  assert.deepEqual(savedCredentials, [
    {
      fixtureId: "fixture-1",
      credentials: { broadcastId: "bcast-1", streamKey: "the-stream-key" },
    },
  ]);
  assert.deepEqual(savedVideoIds, [{
    fixtureId: "fixture-1",
    videoId: "bcast-1",
  }]);
});

Deno.test("the broadcast title is built from both team names and the sport", async () => {
  const { db } = fakeDb();
  let capturedBody = "";
  const fn = (async (url: string | URL, init?: RequestInit) => {
    const u = url.toString();
    if (u.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "at-123" }), {
        status: 200,
      });
    }
    if (u.includes("/liveBroadcasts?")) {
      capturedBody = init!.body as string;
      return new Response(JSON.stringify({ id: "bcast-1" }), { status: 200 });
    }
    if (u.includes("/liveStreams")) {
      return new Response(
        JSON.stringify({
          id: "stream-1",
          cdn: {
            ingestionInfo: { ingestionAddress: "rtmp://x", streamName: "key" },
          },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ id: "bcast-1" }), { status: 200 });
  }) as typeof fetch;

  await provisionFixtureBroadcast("fixture-1", {
    db,
    fetchFn: fn,
    googleClientId: "id",
    googleClientSecret: "secret",
  });

  const sent = JSON.parse(capturedBody);
  assert.deepEqual(
    sent.snippet.title,
    "Riverside 1st XV vs Oak Park 1st XV (rugby)",
  );
});

Deno.test("a fresh liveStream is created per call, never reused across fixtures", async () => {
  const { db } = fakeDb();
  const { fn, calls } = fakeGoogleApi();

  await provisionFixtureBroadcast("fixture-1", {
    db,
    fetchFn: fn,
    googleClientId: "id",
    googleClientSecret: "secret",
  });
  await provisionFixtureBroadcast("fixture-1", {
    db,
    fetchFn: fn,
    googleClientId: "id",
    googleClientSecret: "secret",
  });

  const streamInsertCalls = calls.filter((u) => u.includes("/liveStreams"));
  assert.deepEqual(
    streamInsertCalls.length,
    2,
    "each provisioning call must create its own stream",
  );
});

Deno.test("failing to resolve a YouTube account aborts before any Google API call", async () => {
  const { db } = fakeDb({
    getYoutubeAccountForSchool: async () => {
      throw new Error("no youtube account configured for this school");
    },
  });
  let fetchWasCalled = false;
  const fn = (async () => {
    fetchWasCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    () =>
      provisionFixtureBroadcast("fixture-1", {
        db,
        fetchFn: fn,
        googleClientId: "id",
        googleClientSecret: "secret",
      }),
    /no youtube account configured/,
  );
  assert.deepEqual(fetchWasCalled, false);
});

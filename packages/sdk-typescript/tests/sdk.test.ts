import { expect, test } from "bun:test";
import { createStationClient } from "../src/client";
import { createEtagCache } from "../src/http";
import { stationClientOptionsFromEnv } from "../src/env";
import { PUBLIC_SOCKET_PROTOCOL, sdkSchemas } from "../src/schemas";
import { subscribePublicSocket } from "../src/realtime";

const stationBody = {
  contractVersion: 1,
  id: "station-a",
  slug: "station-a",
  name: "Station A",
  timezone: "Europe/Amsterdam",
  publishingLanguage: "en",
  resources: {
    schemas: "/api/v1/stations/station-a/schemas",
    content: "/api/v1/stations/station-a/content",
    schedule: "/api/v1/stations/station-a/schedule",
    programs: "/api/v1/stations/station-a/programs",
    broadcast: "/api/v1/stations/station-a/broadcast/current",
    nowPlaying: "/api/v1/stations/station-a/now-playing",
    trackHistory: "/api/v1/stations/station-a/track-history",
    socket: "/api/v1/stations/station-a/socket",
    weather: null,
    traffic: null,
    media: "/api/media/public/station-a",
  },
  delivery: { cache: "no-store", conditional: "etag", pollIntervalSeconds: 30 },
};

const nowPlayingBody = {
  contractVersion: 1,
  stationId: "station-a",
  timezone: "Europe/Amsterdam",
  track: {
    artist: "Artist",
    title: "Song",
    album: null,
    durationSeconds: 240,
    artworkUrl: "https://i.scdn.co/image/example-cover",
    isPlaying: true,
    observedAt: "2026-10-04T10:00:00.000Z",
    receivedAt: "2026-10-04T10:00:01.000Z",
  },
  elapsedSeconds: 10,
  endsAt: "2026-10-04T10:04:00.000Z",
  freshness: {
    status: "fresh",
    thresholdSeconds: 180,
    ageSeconds: 10,
    observedAt: "2026-10-04T10:00:00.000Z",
    receivedAt: "2026-10-04T10:00:01.000Z",
  },
};

test("public GET uses no-store and conditional ETag", async () => {
  const etag = `"${"a".repeat(64)}"`;
  let secondRequestEtag: string | undefined;
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture-api-token");
    expect(init?.cache).toBe("no-store");
    expect(init?.credentials).toBe("omit");
    const url = String(input);
    if (url.endsWith("/stations/station-a")) {
      if (init?.headers && new Headers(init.headers).get("if-none-match") === etag) {
        secondRequestEtag = etag;
        return new Response(null, { status: 304, headers: { etag } });
      }
      return new Response(JSON.stringify(stationBody), {
        status: 200,
        headers: { etag, "cache-control": "no-store" },
      });
    }
    return new Response(
      JSON.stringify({
        error: {
          code: "NOT_FOUND",
          message: "x",
          requestId: "00000000-0000-4000-8000-000000000001",
        },
      }),
      { status: 404 },
    );
  };

  const client = createStationClient({
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    apiToken: "fixture-api-token",
    fetch: fetchMock as typeof fetch,
    etagCache: createEtagCache(),
  });
  const first = await client.getStation();
  expect(first.slug).toBe("station-a");
  expect(await client.recommendedPollIntervalMs()).toBe(30_000);
  const second = await client.getStation();
  expect(second.slug).toBe("station-a");
  expect(secondRequestEtag).toBe(etag);
});

test("getNowPlaying returns track artworkUrl", async () => {
  const fetchMock = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/stations/station-a")) return Response.json(stationBody);
    if (url.endsWith("/now-playing")) return Response.json(nowPlayingBody);
    throw new Error(`unexpected url ${url}`);
  };
  const client = createStationClient({
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    apiToken: "fixture-api-token",
    fetch: fetchMock as typeof fetch,
  });
  const nowPlaying = await client.getNowPlaying();
  expect(nowPlaying.track?.artworkUrl).toBe("https://i.scdn.co/image/example-cover");
});

test("disabled traffic and weather do not make a second request", async () => {
  const urls: string[] = [];
  const client = createStationClient({
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    apiToken: "fixture-api-token",
    fetch: async (input) => {
      urls.push(String(input));
      return Response.json(stationBody);
    },
  });
  expect(await client.getWeather()).toBeNull();
  expect(await client.getTraffic()).toBeNull();
  expect(urls).toEqual(["https://radio.example/api/v1/stations/station-a"]);
});

test("getTraffic reads the station traffic resource", async () => {
  const traffic = {
    contractVersion: 1,
    stationId: "station-a",
    snapshot: {
      source: "anwb",
      watch: { roads: [{ id: "nl:a12", code: "A12", name: "A12" }] },
      freshness: {
        status: "fresh",
        thresholdSeconds: 300,
        ageSeconds: 10,
        fetchedAt: "2026-10-04T10:00:00.000Z",
        observedAt: "2026-10-04T10:00:00.000Z",
        lastError: null,
      },
      incidents: [],
      totals: { incidentCount: 0, jamDistanceMeters: 0, delaySeconds: 0 },
    },
  };
  const client = createStationClient({
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    apiToken: "fixture-api-token",
    fetch: async (input) => {
      const url = String(input);
      if (url.endsWith("/stations/station-a")) {
        return Response.json({
          ...stationBody,
          resources: { ...stationBody.resources, traffic: "/api/v1/stations/station-a/traffic" },
        });
      }
      if (url.endsWith("/traffic")) return Response.json(traffic);
      throw new Error(`unexpected url ${url}`);
    },
  });
  expect((await client.getTraffic())?.snapshot.watch.roads[0]?.code).toBe("A12");
});

test("schedule windows stay within 31 inclusive days", async () => {
  const client = createStationClient({
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    apiToken: "fixture-api-token",
    fetch: async () => {
      throw new Error("invalid windows must not be requested");
    },
  });
  await expect(
    client.getSchedule({ fromDate: "2026-10-01", throughDate: "2026-11-01" }),
  ).rejects.toThrow(/31 inclusive days/);
});

test("public socket frames parse and preview frames are ignored", () => {
  const schedule = {
    protocol: PUBLIC_SOCKET_PROTOCOL,
    type: "schedule",
    stationId: "station-a",
    data: {
      contractVersion: 1,
      timezone: "Europe/Amsterdam",
      broadcasts: [],
      truncated: false,
    },
  };
  expect(sdkSchemas.PublicSocketEvent.parse(schedule).type).toBe("schedule");

  class MockSocket {
    static instances: MockSocket[] = [];
    url = "";
    listeners: Record<string, ((event: { data: string }) => void)[]> = {};
    constructor(url: string) {
      this.url = url;
      MockSocket.instances.push(this);
    }
    addEventListener(type: string, listener: (event: { data: string }) => void) {
      this.listeners[type] = [...(this.listeners[type] ?? []), listener];
    }
    close() {}
    emit(data: string) {
      for (const listener of this.listeners.message ?? []) listener({ data });
    }
  }

  let scheduleCount = 0;
  subscribePublicSocket({
    socketUrl: "/api/v1/stations/station-a/socket",
    radioToolsOrigin: "https://radio.example",
    handlers: { onSchedule: () => scheduleCount++ },
    apiToken: "fixture-api-token",
    createSocket: (url, headers) => {
      expect(headers.authorization).toBe("Bearer fixture-api-token");
      expect(url.startsWith("wss://radio.example/")).toBe(true);
      expect(url.includes("token=")).toBe(false);
      return new MockSocket(url) as unknown as WebSocket;
    },
  });

  const socket = MockSocket.instances[0];
  if (!socket) throw new Error("socket was not created");
  socket.emit(
    JSON.stringify({
      protocol: PUBLIC_SOCKET_PROTOCOL,
      type: "preview",
      stationId: "station-a",
      data: { id: "00000000-0000-4000-8000-000000000002" },
    }),
  );
  socket.emit(JSON.stringify(schedule));
  expect(scheduleCount).toBe(1);
});

test("SDK sources do not import application server modules", async () => {
  const glob = new Bun.Glob("src/**/*.ts");
  for await (const entry of glob.scan({ cwd: process.cwd() })) {
    const source = await Bun.file(entry).text();
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = match[1] ?? "";
      expect(spec.includes("/server/")).toBe(false);
      expect(spec.includes("/worker/")).toBe(false);
      expect(spec.startsWith("@/")).toBe(false);
    }
  }
});

test("ETag caches are isolated by listener token", async () => {
  const etagCache = createEtagCache();
  let revoked = false;
  const calls: { token: string | null; conditional: string | null }[] = [];
  const fetchMock = async (_url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const token = headers.get("authorization");
    calls.push({ token, conditional: headers.get("if-none-match") });
    if (revoked) {
      return Response.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required",
            requestId: "00000000-0000-4000-8000-000000000001",
          },
        },
        { status: 401 },
      );
    }
    return Response.json(
      { ...stationBody, name: token },
      { headers: { etag: '"shared-etag"' } },
    );
  };
  const options = {
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    fetch: fetchMock as typeof fetch,
    etagCache,
  };
  const a = createStationClient({ ...options, apiToken: "token-a" });
  const b = createStationClient({ ...options, apiToken: "token-b" });
  expect((await a.getStation()).name).toBe("Bearer token-a");
  expect((await b.getStation()).name).toBe("Bearer token-b");
  expect(calls[1]?.conditional).toBeNull();
  revoked = true;
  await expect(a.getStation()).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  expect(calls[2]?.conditional).toBe('"shared-etag"');
});

test("GraphQL authentication denial does not fall back to REST", async () => {
  const paths: string[] = [];
  const client = createStationClient({
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    apiToken: "fixture-token",
    transport: "auto",
    fetch: async (url, init) => {
      paths.push(new URL(url).pathname);
      expect(init?.credentials).toBe("omit");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture-token");
      return Response.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required",
            requestId: "00000000-0000-4000-8000-000000000001",
          },
        },
        { status: 401 },
      );
    },
  });
  await expect(client.getStation()).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  expect(paths).toEqual(["/api/v1/stations/station-a/graphql"]);
});

test("429 responses retry and then succeed", async () => {
  let calls = 0;
  const client = createStationClient({
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    apiToken: "fixture-api-token",
    retries: 1,
    fetch: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: "slow down" }), {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return Response.json(stationBody);
    },
  });
  expect((await client.getStation()).slug).toBe("station-a");
  expect(calls).toBe(2);
});

test("reportPlayback uses the ingest token and reuses eventId across retries", async () => {
  const bodies: { eventId?: string }[] = [];
  let calls = 0;
  const client = createStationClient({
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    ingestToken: "ingest-token",
    retries: 1,
    fetch: async (input, init) => {
      calls += 1;
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/v1/integrations/playback");
      expect(url.searchParams.get("stationSlug")).toBe("station-a");
      expect(url.searchParams.get("stationId")).toBeNull();
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer ingest-token");
      bodies.push(JSON.parse(String(init?.body)) as { eventId?: string });
      if (calls === 1) {
        return new Response(JSON.stringify({ error: "busy" }), {
          status: 503,
          headers: { "retry-after": "0" },
        });
      }
      return Response.json({ accepted: true, outcome: "recorded" });
    },
  });
  const result = await client.reportPlayback({ streamTitle: "Artist - Title", isPlaying: true });
  expect(result).toEqual({ accepted: true, outcome: "recorded" });
  expect(bodies[0]?.eventId).toBe(bodies[1]?.eventId);
  expect(bodies[0]?.eventId?.length).toBeGreaterThan(0);
});

test("listener reads require a listener token", async () => {
  const client = createStationClient({
    baseUrl: "https://radio.example",
    stationSlug: "station-a",
    ingestToken: "ingest-token",
  });
  await expect(client.getStation()).rejects.toThrow(/listener:read/);
});

test("environment options accept either customer credential", () => {
  expect(
    stationClientOptionsFromEnv({
      RADIOTOOLS_BASE_URL: "https://radio.example",
      RADIOTOOLS_STATION_SLUG: "breeze",
      RADIOTOOLS_INGEST_TOKEN: "rtm_ingest",
    }),
  ).toEqual({
    baseUrl: "https://radio.example",
    stationSlug: "breeze",
    ingestToken: "rtm_ingest",
  });
  expect(() => stationClientOptionsFromEnv({})).toThrow(/RADIOTOOLS_BASE_URL/);
});

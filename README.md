<img src="assets/icon.svg" width="64" height="64" alt="">

# @radiotools/sdk

TypeScript client for **radio stations** using the RadioTools customer API.

It reads published station data and sends encoder playback observations. It does not call Studio administration routes and it never sends session cookies. Keep credentials on the station's own server. Do not bundle them into a website, app, or player.

## Credentials

Create keys in RadioTools under **Settings → API credentials**.

| Use | Credential | Scope |
| --- | --- | --- |
| Website, app, or player backend | Station key | `listener:read` |
| Encoder or automation | Integration key named `playback` | `ingest:write` |

Store them as `RADIOTOOLS_API_TOKEN` and `RADIOTOOLS_INGEST_TOKEN`. Pass the raw `rtm_…` value. The SDK adds the `Bearer ` prefix. A listener key cannot ingest playback, and an ingest key cannot read published JSON.

Also set `RADIOTOOLS_BASE_URL` to the RadioTools origin and `RADIOTOOLS_STATION_SLUG` to the station slug. In **Settings → Public APIs**, enable the resources this station should expose.

## Install

This package is private to radio-station customers (`UNLICENSED`). Depend on it from the station project that received this repository.

```ts
import { createStationClient, createStationClientFromEnv } from "@radiotools/sdk";

const client = createStationClientFromEnv();
// or
const client = createStationClient({
  baseUrl: "https://radio.example",
  stationSlug: "breeze",
  apiToken: process.env.RADIOTOOLS_API_TOKEN,
  ingestToken: process.env.RADIOTOOLS_INGEST_TOKEN,
});
```

An encoder that only reports now-playing can omit `apiToken`. A website that only reads can omit `ingestToken`.

## Read published data

JSON responses are `Cache-Control: no-store` and carry a strong ETag. Pass `etagCache: createEtagCache()` so repeat reads send `If-None-Match`. Poll on `recommendedPollIntervalMs()` (currently 30 seconds) or subscribe to the socket.

`transport` is `http` by default. Set `transport: "graphql"` or `"auto"` to use the station GraphQL route. `"auto"` falls back to HTTP only when that route is missing. An authentication failure does not fall back.

```ts
import { createEtagCache, createStationClient, publicMediaUrl } from "@radiotools/sdk";

const client = createStationClient({
  baseUrl: process.env.RADIOTOOLS_BASE_URL!,
  stationSlug: process.env.RADIOTOOLS_STATION_SLUG!,
  apiToken: process.env.RADIOTOOLS_API_TOKEN!,
  etagCache: createEtagCache(),
});

const station = await client.getStation();
const news = await client.getContent({ type: "news", limit: 10 });
for await (const article of client.iterateContent({ type: "news" })) {
  console.log(article.id, article.revision);
}

const schedule = await client.getSchedule({
  fromDate: "2026-10-04",
  throughDate: "2026-10-11",
});
const onAir = await client.getCurrentBroadcast();
const nowPlaying = await client.getNowPlaying();
const cover = nowPlaying.track?.artworkUrl ?? null;
const weather = await client.getWeather(); // null when the station has not enabled it
const traffic = await client.getTraffic();

const artwork = publicMediaUrl(
  process.env.RADIOTOOLS_BASE_URL!,
  station.resources.media,
  news.records[0].media[0].versionId,
  "display",
);
```

Schedule and program windows are 1 to 31 inclusive days. Weather and traffic return `null` when that resource is disabled or the station is not entitled to redistribute it.

A disabled resource throws `Public <name> API is unavailable for this station` when you request it. `401` means the bearer token is missing, expired, revoked, or has the wrong scope. `404` means the station, resource, or record is not available. `429` and `503` are retried up to two extra times, honoring a numeric `Retry-After` up to five seconds.

## Playback ingest

Create one observation per play event. The SDK assigns `eventId` when you omit it and reuses that id if the request is retried.

```ts
await client.reportPlayback({
  artist: "Example Artist",
  title: "Example Track",
  durationSeconds: 215,
  artworkUrl: "https://cdn.example/cover.jpg",
  isPlaying: true,
});
```

`streamTitle: "Artist - Title"` is accepted instead of separate artist and title fields. `artworkUrl` must be HTTPS with no userinfo. The body must stay within 8 KiB. To target the internal station id instead of the slug, call `reportPlayback(observation, { stationId })`.

## Realtime

`subscribe` needs a server WebSocket adapter that attaches the Authorization header. The browser `WebSocket` constructor cannot set that header, so a public site should bridge the socket on its own server.

```ts
const subscription = client.subscribe(
  {
    onNowPlaying: (data) => console.log(data.track?.title, data.track?.artworkUrl),
    onAir: (state) => console.log(state?.status),
    onSchedule: (data) => console.log(data.broadcasts.length),
    onContent: (id, record) => console.log(id, record?.revision),
  },
  { fromDate: "2026-10-04", throughDate: "2026-10-11" },
);

subscription.close();
```

Preview frames on the public socket are ignored. Unpublished editorial preview uses `previewEditorial(grant, input)` with a preview grant passed as an argument, not taken from a query string.

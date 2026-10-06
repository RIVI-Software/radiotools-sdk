# @rivi-software/radiotools-sdk

TypeScript client for the RadioTools listener API: published station content, schedule, now playing, weather and traffic, realtime updates, and playback ingest. Includes ETag caching and retries.

## Install

```bash
npm install @rivi-software/radiotools-sdk
```

## Configuration

Create keys in RadioTools under **Settings → API credentials**.

| Variable | Purpose |
| --- | --- |
| `RADIOTOOLS_BASE_URL` | API base URL |
| `RADIOTOOLS_STATION_SLUG` | Station to read from |
| `RADIOTOOLS_API_TOKEN` | Station key (`listener:read`) |
| `RADIOTOOLS_INGEST_TOKEN` | Integration key named `playback` (`ingest:write`) |

Pass the raw `rtm_…` token; the SDK adds the `Bearer ` prefix.

## Usage

```ts
import { createStationClient, createStationClientFromEnv } from "@rivi-software/radiotools-sdk";

const client = createStationClientFromEnv();
// or
const explicit = createStationClient({
  baseUrl: "https://api.example.com",
  stationSlug: "my-station",
  apiToken: process.env.RADIOTOOLS_API_TOKEN,
});

const station = await client.getStation();
const nowPlaying = await client.getNowPlaying();
const schedule = await client.getSchedule({ fromDate: "2026-10-06", throughDate: "2026-10-12" });
```

### Client methods

`getStation`, `getSchemas`, `getContent`, `getContentRecord`, `iterateContent`, `getSchedule`, `getPrograms`, `getCurrentBroadcast`, `getNowPlaying`, `getTrackHistory`, `iterateTrackHistory`, `getWeather`, `getTraffic`, `recommendedPollIntervalMs`, `previewEditorial`, `reportPlayback`, `subscribe`.

Schedule windows are `YYYY-MM-DD` dates covering 1 to 31 inclusive days.

### Realtime

```ts
const subscription = client.subscribe({
  /* handlers for public socket events */
});
```

### Playback ingest

Requires `RADIOTOOLS_INGEST_TOKEN`. Use `client.reportPlayback(observation)`.

### Errors

Failed requests throw `RadioToolsApiError`. Response types and Zod schemas (`sdkSchemas`) are exported for validation.

Framework bindings: [React](../sdk-react), [Vue](../sdk-vue), [Svelte](../sdk-svelte), [Next.js](../sdk-next).

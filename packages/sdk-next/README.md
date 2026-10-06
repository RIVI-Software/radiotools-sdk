# @rivi-software/radiotools-sdk-next

Next.js App Router server helpers for the RadioTools listener API, wrapping [`@rivi-software/radiotools-sdk`](../sdk-typescript). Generated from `@rivi-software/radiotools-contract`; do not edit `src/server.generated.ts` by hand.

The package imports `server-only`, so it can only be used in Server Components, Route Handlers and Server Actions. Your API token never reaches the browser.

## Install

```bash
npm install @rivi-software/radiotools-sdk-next @rivi-software/radiotools-sdk
```

Requires Next.js 14.2 or newer. Set `RADIOTOOLS_BASE_URL`, `RADIOTOOLS_STATION_SLUG` and `RADIOTOOLS_API_TOKEN` in the server environment.

## Usage

Server Component with caching (30 s revalidation by default):

```tsx
import { cachedGetNowPlaying } from "@rivi-software/radiotools-sdk-next";

export default async function Page() {
  const nowPlaying = await cachedGetNowPlaying();
  return <p>{nowPlaying.track?.title}</p>;
}
```

Route Handler:

```ts
import { createRadioToolsServerClient, jsonResponseNowPlaying } from "@rivi-software/radiotools-sdk-next";

export async function GET() {
  return jsonResponseNowPlaying(createRadioToolsServerClient());
}
```

## Exports

- `createRadioToolsServerClient(overrides?)`: client built from environment variables.
- `createCachedRadioToolsReader(key, read, revalidateSeconds?)`: wrap any read in `unstable_cache`.
- `cachedGetStation`, `cachedGetNowPlaying`, `cachedGetCurrentBroadcast`: ready-made cached readers.
- `fetchGet*` and `fetchRecommendedPollIntervalMs`: plain reads for a given client.
- `jsonResponse*`: `NextResponse` wrappers for Route Handlers.

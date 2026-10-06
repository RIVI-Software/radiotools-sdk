# @rivi-software/radiotools-sdk-react

React hooks for the RadioTools listener API, wrapping [`@rivi-software/radiotools-sdk`](../sdk-typescript). Generated from `@rivi-software/radiotools-contract`; do not edit `src/hooks.generated.ts` by hand.

## Install

```bash
npm install @rivi-software/radiotools-sdk-react @rivi-software/radiotools-sdk
```

Requires React 18 or newer.

## Usage

```tsx
import { createStationClient } from "@rivi-software/radiotools-sdk";
import { useGetNowPlaying } from "@rivi-software/radiotools-sdk-react";

const client = createStationClient({ baseUrl, stationSlug, apiToken });

export function NowPlaying() {
  const { data, error, loading, refresh } = useGetNowPlaying(client);
  if (loading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;
  return <p>{data?.track?.title}</p>;
}
```

Create the client once, outside components or in a memo, so the hooks keep a stable reference.

## Hooks

`useGetStation`, `useGetCurrentBroadcast`, `useGetNowPlaying`, `useGetWeather`, `useGetTraffic`, `useRecommendedPollInterval`. Each returns `{ data, error, loading, refresh }`.

For anything else, call the client directly.

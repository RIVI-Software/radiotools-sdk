# @rivi-software/radiotools-sdk-svelte

Svelte stores for the RadioTools listener API, wrapping [`@rivi-software/radiotools-sdk`](../sdk-typescript). Generated from `@rivi-software/radiotools-contract`; do not edit `src/stores.generated.ts` by hand.

## Install

```bash
npm install @rivi-software/radiotools-sdk-svelte @rivi-software/radiotools-sdk
```

Requires Svelte 4 or newer.

## Usage

```svelte
<script lang="ts">
  import { createStationClient } from "@rivi-software/radiotools-sdk";
  import { createGetNowPlayingStore } from "@rivi-software/radiotools-sdk-svelte";

  const client = createStationClient({ baseUrl, stationSlug, apiToken });
  const nowPlaying = createGetNowPlayingStore(client);
</script>

{#if $nowPlaying.loading}
  <p>Loading…</p>
{:else if $nowPlaying.error}
  <p>{$nowPlaying.error.message}</p>
{:else}
  <p>{$nowPlaying.data?.track?.title}</p>
{/if}
```

## Stores

`createGetStationStore`, `createGetCurrentBroadcastStore`, `createGetNowPlayingStore`, `createGetWeatherStore`, `createGetTrafficStore`, `createRecommendedPollIntervalStore`. Each store holds `{ data, error, loading }` and has a `refresh()` method. `stationStoreLoading(store)` derives a loading-only store.

# @rivi-software/radiotools-sdk-vue

Vue composables for the RadioTools listener API, wrapping [`@rivi-software/radiotools-sdk`](../sdk-typescript). Generated from `@rivi-software/radiotools-contract`; do not edit `src/composables.generated.ts` by hand.

## Install

```bash
npm install @rivi-software/radiotools-sdk-vue @rivi-software/radiotools-sdk
```

Requires Vue 3.4 or newer.

## Usage

```vue
<script setup lang="ts">
import { createStationClient } from "@rivi-software/radiotools-sdk";
import { useGetNowPlaying } from "@rivi-software/radiotools-sdk-vue";

const client = createStationClient({ baseUrl, stationSlug, apiToken });
const { data, error, loading, refresh } = useGetNowPlaying(client);
</script>

<template>
  <p v-if="loading">Loading…</p>
  <p v-else-if="error">{{ error.message }}</p>
  <p v-else>{{ data?.track?.title }}</p>
</template>
```

## Composables

`useGetStation`, `useGetCurrentBroadcast`, `useGetNowPlaying`, `useGetWeather`, `useGetTraffic`, `useRecommendedPollInterval`. Each returns refs `{ data, error, loading }` and a `refresh()` function.

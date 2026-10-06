import { type CreateStationClientOptions, createStationClient, type StationClient } from "./client";

export type RadioToolsEnv = {
  RADIOTOOLS_BASE_URL?: string;
  RADIOTOOLS_STATION_SLUG?: string;
  RADIOTOOLS_API_TOKEN?: string;
  RADIOTOOLS_INGEST_TOKEN?: string;
};

function envValue(env: RadioToolsEnv | undefined, key: keyof RadioToolsEnv): string | undefined {
  if (env) return env[key];
  return process.env[key];
}

export function stationClientOptionsFromEnv(env?: RadioToolsEnv): CreateStationClientOptions {
  const baseUrl = envValue(env, "RADIOTOOLS_BASE_URL")?.trim();
  const stationSlug = envValue(env, "RADIOTOOLS_STATION_SLUG")?.trim();
  const apiToken = envValue(env, "RADIOTOOLS_API_TOKEN")?.trim();
  const ingestToken = envValue(env, "RADIOTOOLS_INGEST_TOKEN")?.trim();
  if (!baseUrl || !stationSlug || (!apiToken && !ingestToken)) {
    throw new Error(
      "Set RADIOTOOLS_BASE_URL, RADIOTOOLS_STATION_SLUG, and RADIOTOOLS_API_TOKEN or RADIOTOOLS_INGEST_TOKEN.",
    );
  }
  return {
    baseUrl,
    stationSlug,
    ...(apiToken ? { apiToken } : {}),
    ...(ingestToken ? { ingestToken } : {}),
  };
}

export function createStationClientFromEnv(
  env?: RadioToolsEnv,
  overrides: Partial<CreateStationClientOptions> = {},
): StationClient {
  return createStationClient({ ...stationClientOptionsFromEnv(env), ...overrides });
}

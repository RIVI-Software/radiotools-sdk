import type { FetchLike } from "./http";
import { postJson } from "./http";
import {
  type SdkPlaybackObservation,
  type SdkPlaybackObservationResult,
  sdkSchemas,
} from "./schemas";

const MAX_PLAYBACK_BODY_BYTES = 8192;

export type ReportPlaybackOptions = {
  baseUrl: string;
  /** Integration credential with integration name `playback` and scope `ingest:write`. */
  ingestToken: string;
  stationSlug?: string;
  stationId?: string;
  observation: SdkPlaybackObservation;
  fetch?: FetchLike;
  retries?: number;
};

/**
 * Send one encoder observation to `POST /api/v1/integrations/playback`.
 * Exactly one of `stationSlug` or `stationId` is sent. A missing `eventId` is
 * assigned once so retries of this call stay idempotent.
 */
export async function reportPlayback(
  options: ReportPlaybackOptions,
): Promise<SdkPlaybackObservationResult> {
  const ingestToken = options.ingestToken.trim();
  if (!ingestToken) throw new Error("Playback ingest token is required");
  if (options.stationId && options.stationSlug) {
    throw new Error("Send exactly one of stationId or stationSlug");
  }
  if (!options.stationId && !options.stationSlug) {
    throw new Error("stationSlug or stationId is required");
  }

  const parsed = sdkSchemas.PlaybackObservationIngestBody.parse(options.observation);
  const body = { ...parsed, eventId: parsed.eventId ?? crypto.randomUUID() };
  const payload = JSON.stringify(body);
  if (new TextEncoder().encode(payload).byteLength > MAX_PLAYBACK_BODY_BYTES) {
    throw new Error("Playback observation exceeds 8 KiB");
  }

  const url = new URL("/api/v1/integrations/playback", options.baseUrl);
  if (options.stationId) url.searchParams.set("stationId", options.stationId);
  else if (options.stationSlug) url.searchParams.set("stationSlug", options.stationSlug);

  return postJson(url.href, body, sdkSchemas.PlaybackObservationResult, {
    fetch: options.fetch,
    headers: { authorization: `Bearer ${ingestToken}` },
    cache: "no-store",
    credentials: "omit",
    retries: options.retries,
    rawBody: payload,
  });
}

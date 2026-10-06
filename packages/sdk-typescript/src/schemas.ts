// Customer API contract version 1.
// Radio-station shapes only: published reads, the public socket, preview, and playback ingest.
// Studio administration contracts are intentionally absent.
import { z } from "zod";

export const LISTENER_CONTRACT_VERSION = 1 as const;
export const ListenerContractVersion = z.literal(LISTENER_CONTRACT_VERSION);
export const PUBLIC_SOCKET_PROTOCOL = "radiotools.public.v1" as const;

export const RequestId = z.string().uuid();
export const ErrorCode = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "REVISION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "INTERNAL_ERROR",
]);
export const ErrorResponse = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    requestId: RequestId,
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export const IngestErrorResponse = z.object({ error: z.string() });

export const Timezone = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    if (/^[+-]/.test(value)) return false;
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA timezone");

const href = z.string().startsWith("/api/");

export const PublicStation = z.object({
  contractVersion: ListenerContractVersion,
  id: z.string().min(1).max(80),
  slug: z.string().min(3).max(63),
  name: z.string().min(1).max(120),
  timezone: Timezone,
  publishingLanguage: z.string().min(2).max(35),
  resources: z.object({
    schemas: href,
    content: href.nullable(),
    schedule: href.nullable(),
    programs: href.nullable(),
    broadcast: href.nullable(),
    nowPlaying: href.nullable(),
    trackHistory: href.nullable(),
    socket: href.nullable(),
    weather: href.nullable(),
    traffic: href.nullable(),
    media: href,
  }),
  delivery: z.object({
    cache: z.literal("no-store"),
    conditional: z.literal("etag"),
    pollIntervalSeconds: z.number().int().positive(),
  }),
});

const FIELD_KINDS = [
  "text",
  "rich_text",
  "number",
  "boolean",
  "datetime",
  "choices",
  "media",
  "content",
  "group",
] as const;

const SchemaKey = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]{0,47}$/,
    "Use lowercase letters, digits and underscores; start with a letter.",
  )
  .refine(
    (key) =>
      ![
        "constructor",
        "prototype",
        "__proto__",
        "id",
        "station_id",
        "revision",
        "schema_version",
        "created_at",
        "updated_at",
      ].includes(key),
    "Reserved identifier.",
  );

const JsonValue = z.json();

export type DeliveryField = {
  key: string;
  label: string;
  kind: (typeof FIELD_KINDS)[number];
  required: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  choices?: { key: string; label: string }[];
  targetType?: string;
  maxItems?: number;
  fields?: DeliveryField[];
};

function deliveryField(depth: number): z.ZodType<DeliveryField> {
  return z
    .object({
      key: SchemaKey,
      label: z.string(),
      kind: z.enum(FIELD_KINDS),
      required: z.boolean(),
      maxLength: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      choices: z.array(z.object({ key: SchemaKey, label: z.string() })).optional(),
      targetType: SchemaKey.optional(),
      maxItems: z.number().optional(),
      fields:
        depth < 3
          ? z.array(deliveryField(depth + 1)).optional()
          : z
              .array(
                z
                  .object({
                    key: SchemaKey,
                    label: z.string(),
                    kind: z.enum(FIELD_KINDS),
                    required: z.boolean(),
                  })
                  .strict(),
              )
              .max(0)
              .optional(),
    })
    .strict();
}

export const PublicSchema = z.object({
  key: SchemaKey,
  label: z.string(),
  version: z.number().int().positive(),
  archived: z.boolean(),
  fields: z.array(deliveryField(1)),
});
export const PublicSchemaList = z.object({
  contractVersion: ListenerContractVersion,
  types: z.array(PublicSchema).max(100),
});

const Span = z
  .object({
    text: z.string().max(20000),
    marks: z
      .array(z.enum(["bold", "italic", "underline", "strike"]))
      .max(4)
      .optional(),
  })
  .strict();
const inline = z.array(Span).max(1000);
const EditorialBlock = z.discriminatedUnion("type", [
  z.object({ id: z.uuid(), type: z.literal("text"), content: inline }).strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal("heading"),
      level: z.number().int().min(1).max(3),
      content: inline,
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal("quote"),
      content: inline,
      attribution: z.string().max(300),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal("image"),
      assetId: z.uuid(),
      alt: z.string().max(1000),
      caption: z.string().max(1000),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal("gallery"),
      images: z
        .array(z.object({ assetId: z.uuid(), alt: z.string().max(1000) }).strict())
        .min(1)
        .max(20),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal("audio"),
      assetId: z.uuid(),
      caption: z.string().max(1000),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal("video"),
      assetId: z.uuid(),
      caption: z.string().max(1000),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal("embed"),
      provider: z.enum(["youtube", "vimeo"]),
      externalId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
      title: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      id: z.uuid(),
      type: z.literal("related"),
      recordIds: z.array(z.uuid()).min(1).max(20),
    })
    .strict(),
]);
export const EditorialDocument = z
  .object({
    version: z.literal(1),
    mode: z.enum(["document", "blocks"]),
    blocks: z.array(EditorialBlock).max(100),
  })
  .strict()
  .superRefine((doc, ctx) => {
    if (new Set(doc.blocks.map((block) => block.id)).size !== doc.blocks.length) {
      ctx.addIssue({ code: "custom", message: "Block IDs must be unique.", path: ["blocks"] });
    }
    if (new TextEncoder().encode(JSON.stringify(doc)).byteLength > 128 * 1024) {
      ctx.addIssue({ code: "custom", message: "Document exceeds 128 KiB." });
    }
  });

export const PublicMedia = z.object({
  assetId: z.uuid(),
  versionId: z.uuid(),
  kind: z.enum(["image", "audio", "video"]),
  url: z.string(),
  credits: z.string(),
  mime: z.string(),
});
export const PublishedRecord = z.object({
  contractVersion: ListenerContractVersion,
  id: z.uuid(),
  publicationId: z.uuid(),
  revision: z.number().int().positive(),
  type: SchemaKey,
  schemaVersion: z.number().int().positive(),
  publishedAt: z.string(),
  values: z.record(z.string(), JsonValue),
  document: EditorialDocument,
  media: z.array(PublicMedia).max(100),
});
export const PublishedCollection = z.object({
  contractVersion: ListenerContractVersion,
  type: SchemaKey,
  records: z.array(PublishedRecord).max(50),
  nextCursor: z.uuid().nullable(),
  page: z.object({
    limit: z.number().int().min(1).max(50),
    nextCursor: z.uuid().nullable(),
  }),
});
export const PreviewInput = z
  .object({
    stationId: z.string().min(1).max(80),
    recordId: z.uuid(),
    revision: z.number().int().positive(),
    audience: z.string().min(1).max(100),
  })
  .strict();
export const RevisionPreview = z.object({
  media: z.array(PublicMedia).max(100),
  id: z.uuid(),
  revision: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  values: z.record(z.string(), JsonValue),
  document: EditorialDocument,
});

const LocalDate = z.iso.date();
export const PublicBroadcast = z.object({
  id: z.uuid(),
  title: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  timezone: Timezone,
  localDate: LocalDate,
  resolution: z.string(),
  status: z.enum(["scheduled", "cancelled", "live", "completed"]),
  cancellationReason: z.string(),
  repeatOfId: z.uuid().nullable(),
  program: z.object({ id: z.uuid(), title: z.string(), profileId: z.uuid().nullable() }),
  presenters: z.array(z.object({ id: z.uuid(), title: z.string() })),
});
export const PublicSchedule = z.object({
  contractVersion: ListenerContractVersion,
  timezone: Timezone,
  broadcasts: z.array(PublicBroadcast),
  truncated: z.boolean(),
});
export const PublicProgram = z.object({
  id: z.uuid(),
  title: z.string(),
  profileId: z.uuid().nullable(),
});
export const PublicPrograms = z.object({
  contractVersion: ListenerContractVersion,
  timezone: Timezone,
  fromDate: LocalDate,
  throughDate: LocalDate,
  programs: z.array(PublicProgram).max(500),
  truncated: z.boolean(),
});
export const PublicCurrentBroadcast = z.object({
  contractVersion: ListenerContractVersion,
  timezone: Timezone,
  asOf: z.iso.datetime(),
  broadcast: PublicBroadcast.nullable(),
});

export const PlaybackArtworkUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "artworkUrl must be an https URL");

const playbackDuration = z.number().int().min(0).max(86400).nullable();

/** Wire JSON for `POST /api/v1/integrations/playback`. */
export const PlaybackObservationIngestBody = z
  .object({
    eventId: z.string().trim().min(1).max(100).optional(),
    observedAt: z.number().int().min(0).max(8_640_000_000_000_000).optional(),
    artist: z.string().trim().min(1).max(500).optional(),
    title: z.string().trim().min(1).max(500).optional(),
    streamTitle: z.string().trim().min(1).max(1001).optional(),
    album: z.string().trim().min(1).max(500).optional(),
    sourceTrackId: z.string().trim().min(1).max(120).optional(),
    artworkUrl: PlaybackArtworkUrl.optional(),
    durationSeconds: playbackDuration.optional(),
    duration: playbackDuration.optional(),
    isPlaying: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasArtist = value.artist !== undefined;
    const hasTitle = value.title !== undefined;
    if (hasArtist !== hasTitle) {
      ctx.addIssue({
        code: "custom",
        message: "artist and title must be supplied together",
        path: hasArtist ? ["title"] : ["artist"],
      });
    }
    if (!hasArtist && value.streamTitle === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Provide artist and title or streamTitle",
        path: ["streamTitle"],
      });
    }
    if (hasArtist && value.streamTitle !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Use either artist and title or streamTitle",
        path: ["streamTitle"],
      });
    }
    if (
      value.duration !== undefined &&
      value.durationSeconds !== undefined &&
      value.duration !== value.durationSeconds
    ) {
      ctx.addIssue({
        code: "custom",
        message: "duration and durationSeconds must match when both are set",
        path: ["duration"],
      });
    }
  });

export const PlaybackObservationResult = z.object({
  accepted: z.boolean(),
  outcome: z.enum([
    "no-live-broadcast",
    "on-air-not-following-rundown",
    "not-playing",
    "rejected",
    "recorded",
    "matched",
    "uncertain",
    "ignored",
  ]),
});

const PlaybackFreshnessStatus = z.enum(["fresh", "stale", "empty"]);
const PublicPlaybackTrack = z
  .object({
    artist: z.string(),
    title: z.string(),
    album: z.string().nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    artworkUrl: PlaybackArtworkUrl.optional(),
    isPlaying: z.boolean(),
    observedAt: z.string().datetime(),
    receivedAt: z.string().datetime(),
  })
  .strict();
const PlaybackFreshness = z
  .object({
    status: PlaybackFreshnessStatus,
    thresholdSeconds: z.number().int().positive(),
    ageSeconds: z.number().int().nonnegative().nullable(),
    observedAt: z.string().datetime().nullable(),
    receivedAt: z.string().datetime().nullable(),
  })
  .strict();
export const PublicNowPlaying = z
  .object({
    contractVersion: ListenerContractVersion,
    stationId: z.string(),
    timezone: Timezone,
    track: PublicPlaybackTrack.nullable(),
    elapsedSeconds: z.number().int().nonnegative().nullable(),
    endsAt: z.string().datetime().nullable(),
    freshness: PlaybackFreshness,
  })
  .strict();
const PublicHistoryEntry = PublicPlaybackTrack.extend({
  id: z.string().min(1).max(80),
});
export const PublicTrackHistory = z
  .object({
    contractVersion: ListenerContractVersion,
    stationId: z.string(),
    items: z.array(PublicHistoryEntry),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict();

const WeatherConditionCode = z.enum([
  "Clear",
  "MostlyClear",
  "PartlyCloudy",
  "Cloudy",
  "Fog",
  "Drizzle",
  "FreezingDrizzle",
  "Rain",
  "HeavyRain",
  "FreezingRain",
  "Snow",
  "HeavySnow",
  "Flurries",
  "Showers",
  "SnowShowers",
  "Thunderstorm",
  "SevereThunderstorm",
]);
const WeatherRegionId = z.string().regex(/^[a-z]{2}:[a-z0-9][a-z0-9_-]{0,62}$/);
const WeatherCoverageArea = z
  .object({
    id: WeatherRegionId,
    name: z.string(),
    countryCode: z.string().regex(/^[a-z]{2}$/),
    countryName: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    timezone: Timezone,
  })
  .strict();
const WeatherCurrent = z
  .object({
    asOf: z.string().datetime(),
    conditionCode: WeatherConditionCode,
    daylight: z.boolean(),
    precipitation: z.number(),
    temperature: z.number(),
    temperatureApparent: z.number(),
    uvIndex: z.number(),
    windDirection: z.number(),
    windGust: z.number(),
    windSpeed: z.number(),
  })
  .strict();
const WeatherHour = z
  .object({
    forecastStart: z.string().datetime(),
    conditionCode: WeatherConditionCode,
    daylight: z.boolean(),
    precipitation: z.number(),
    precipitationChance: z.number().min(0).max(1),
    temperature: z.number(),
    temperatureApparent: z.number(),
    windDirection: z.number(),
    windGust: z.number(),
    windSpeed: z.number(),
  })
  .strict();
const WeatherDay = z
  .object({
    forecastStart: z.string().datetime(),
    conditionCode: WeatherConditionCode,
    precipitationAmount: z.number(),
    precipitationChance: z.number().min(0).max(1),
    sunriseTime: z.string().datetime(),
    sunsetTime: z.string().datetime(),
    temperatureMax: z.number(),
    temperatureMin: z.number(),
    uvIndex: z.number(),
    windDirection: z.number(),
    windGust: z.number(),
    windSpeed: z.number(),
  })
  .strict();
const WeatherFreshness = z
  .object({
    status: z.enum(["fresh", "stale", "unavailable", "empty"]),
    thresholdSeconds: z.number().int().positive(),
    ageSeconds: z.number().int().nonnegative().nullable(),
    fetchedAt: z.string().datetime().nullable(),
    observedAt: z.string().datetime().nullable(),
    lastError: z.string().nullable(),
  })
  .strict();
const WeatherSnapshot = z
  .object({
    source: z.literal("open-meteo"),
    coverage: WeatherCoverageArea,
    freshness: WeatherFreshness,
    current: WeatherCurrent.nullable(),
    hourly: z.array(WeatherHour),
    daily: z.array(WeatherDay),
  })
  .strict();
export const WeatherPublic = z
  .object({
    contractVersion: ListenerContractVersion,
    stationId: z.string(),
    timezone: Timezone,
    snapshots: z.array(WeatherSnapshot),
  })
  .strict();

const TrafficRoadId = z.string().regex(/^nl:[an](?:[0-9]{1,3}|-all)$/, "Use nl:{road} watch ids");
const TrafficWatchRoad = z
  .object({
    id: TrafficRoadId,
    code: z.string().min(2).max(8),
    name: z.string(),
  })
  .strict();
const TrafficIncident = z
  .object({
    id: z.string(),
    road: z.string(),
    type: z.enum(["jam", "roadworks", "closure", "speed_check"]),
    direction: z.enum([
      "northbound",
      "southbound",
      "eastbound",
      "westbound",
      "both",
      "unknown",
    ]),
    from: z.string(),
    to: z.string(),
    lengthMeters: z.number().int().nonnegative().nullable(),
    delaySeconds: z.number().int().nonnegative().nullable(),
    summary: z.string(),
    updatedAt: z.string().datetime(),
  })
  .strict();
const TrafficSnapshot = z
  .object({
    source: z.literal("anwb"),
    watch: z.object({ roads: z.array(TrafficWatchRoad) }).strict(),
    freshness: z
      .object({
        status: z.enum(["fresh", "stale", "unavailable", "empty"]),
        thresholdSeconds: z.number().int().positive(),
        ageSeconds: z.number().int().nonnegative().nullable(),
        fetchedAt: z.string().datetime().nullable(),
        observedAt: z.string().datetime().nullable(),
        lastError: z.string().nullable(),
      })
      .strict(),
    incidents: z.array(TrafficIncident),
    totals: z
      .object({
        incidentCount: z.number().int().nonnegative(),
        jamDistanceMeters: z.number().int().nonnegative(),
        delaySeconds: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export const TrafficPublic = z
  .object({
    contractVersion: ListenerContractVersion,
    stationId: z.string(),
    snapshot: TrafficSnapshot,
  })
  .strict();

export const PublicOnAir = z
  .object({
    broadcastId: z.uuid(),
    status: z.enum(["scheduled", "live", "completed"]),
    activeItemId: z.uuid().nullable(),
    observation: z
      .object({
        observedAt: z.number(),
        itemId: z.uuid().nullable(),
        durationSeconds: z.number().nullable(),
        outcome: z.enum(["matched", "uncertain", "ignored"]),
      })
      .strict()
      .nullable(),
  })
  .strict();

const socketEnvelope = {
  protocol: z.literal(PUBLIC_SOCKET_PROTOCOL),
  stationId: z.string().min(1).max(80),
};
export const PublicSocketEvent = z.discriminatedUnion("type", [
  z.object({ ...socketEnvelope, type: z.literal("schedule"), data: PublicSchedule }).strict(),
  z.object({ ...socketEnvelope, type: z.literal("on-air"), data: PublicOnAir.nullable() }).strict(),
  z
    .object({ ...socketEnvelope, type: z.literal("now-playing"), data: PublicNowPlaying })
    .strict(),
  z
    .object({
      ...socketEnvelope,
      type: z.literal("content"),
      recordId: z.uuid(),
      data: PublishedRecord.nullable(),
    })
    .strict(),
  z.object({ ...socketEnvelope, type: z.literal("preview"), data: RevisionPreview }).strict(),
]);

export const sdkSchemas = {
  ErrorResponse,
  IngestErrorResponse,
  PublicStation,
  PublicSchema,
  PublicSchemaList,
  PublishedRecord,
  PublishedCollection,
  PublicSchedule,
  PublicPrograms,
  PublicCurrentBroadcast,
  WeatherPublic,
  TrafficPublic,
  PreviewInput,
  RevisionPreview,
  PlaybackObservationIngestBody,
  PlaybackObservationResult,
  PublicNowPlaying,
  PublicTrackHistory,
  PublicOnAir,
  PublicSocketEvent,
} as const;

export type SdkErrorResponse = z.infer<typeof ErrorResponse>;
export type SdkErrorCode = z.infer<typeof ErrorCode>;
export type SdkPublicStation = z.infer<typeof PublicStation>;
export type SdkPublicSchema = z.infer<typeof PublicSchema>;
export type SdkPublicSchemaList = z.infer<typeof PublicSchemaList>;
export type SdkPublishedRecord = z.infer<typeof PublishedRecord>;
export type SdkPublishedCollection = z.infer<typeof PublishedCollection>;
export type SdkPublicSchedule = z.infer<typeof PublicSchedule>;
export type SdkPublicPrograms = z.infer<typeof PublicPrograms>;
export type SdkPublicCurrentBroadcast = z.infer<typeof PublicCurrentBroadcast>;
export type SdkWeatherPublic = z.infer<typeof WeatherPublic>;
export type SdkTrafficPublic = z.infer<typeof TrafficPublic>;
export type SdkPreviewInput = z.infer<typeof PreviewInput>;
export type SdkRevisionPreview = z.infer<typeof RevisionPreview>;
export type SdkPlaybackObservation = z.input<typeof PlaybackObservationIngestBody>;
export type SdkPlaybackObservationResult = z.infer<typeof PlaybackObservationResult>;
export type SdkPublicNowPlaying = z.infer<typeof PublicNowPlaying>;
export type SdkPublicTrackHistory = z.infer<typeof PublicTrackHistory>;
export type SdkPublicOnAir = z.infer<typeof PublicOnAir>;
export type SdkPublicSocketEvent = z.infer<typeof PublicSocketEvent>;

import {
  contentQuery,
  contentRecordQuery,
  currentBroadcastQuery,
  graphqlRequest,
  isGraphqlUnavailable,
  nowPlayingQuery,
  parseGraphqlContent,
  parseGraphqlCurrentBroadcast,
  parseGraphqlNowPlaying,
  parseGraphqlPrograms,
  parseGraphqlSchedule,
  parseGraphqlSchemas,
  parseGraphqlStation,
  parseGraphqlTrackHistory,
  parseGraphqlTraffic,
  parseGraphqlWeather,
  programsQuery,
  scheduleQuery,
  schemasQuery,
  stationQuery,
  trackHistoryQuery,
  trafficQuery,
  weatherQuery,
} from "./graphql";
import type { EtagCache, FetchLike, PublicJsonRequestOptions } from "./http";
import { readPublicJson } from "./http";
import { reportPlayback } from "./playback";
import { previewEditorial } from "./preview";
import type { PublicSocketHandlers, PublicSocketSubscription } from "./realtime";
import { type SubscribePublicSocketOptions, subscribePublicSocket } from "./realtime";
import type {
  SdkPlaybackObservation,
  SdkPlaybackObservationResult,
  SdkPreviewInput,
  SdkPublicCurrentBroadcast,
  SdkPublicNowPlaying,
  SdkPublicPrograms,
  SdkPublicSchedule,
  SdkPublicSchemaList,
  SdkPublicStation,
  SdkPublicTrackHistory,
  SdkPublishedCollection,
  SdkPublishedRecord,
  SdkRevisionPreview,
  SdkTrafficPublic,
  SdkWeatherPublic,
} from "./schemas";
import { sdkSchemas } from "./schemas";

export type StationClientTransport = "http" | "graphql" | "auto";

export type CreateStationClientOptions = {
  baseUrl: string;
  stationSlug: string;
  /** Credential with `listener:read`. Required for published reads. */
  apiToken?: string;
  /** Integration credential named `playback` with `ingest:write`. Required for `reportPlayback`. */
  ingestToken?: string;
  createSocket?: SubscribePublicSocketOptions["createSocket"];
  fetch?: FetchLike;
  etagCache?: EtagCache;
  /**
   * `http` — REST reads with ETag conditional GET (default).
   * `graphql` — POST /api/v1/stations/{slug}/graphql.
   * `auto` — GraphQL, falling back to HTTP when that route is missing.
   */
  transport?: StationClientTransport;
  /** @deprecated Use `transport: "auto"`. */
  graphql?: boolean;
  /** Extra attempts after HTTP 429 or 503. Defaults to 2. */
  retries?: number;
};

export type ContentListOptions = {
  type: string;
  cursor?: string;
  limit?: number;
  filter?: string[];
};

export type ScheduleWindow = {
  fromDate: string;
  throughDate: string;
};

export type TrackHistoryOptions = {
  cursor?: string;
  limit?: number;
};

export type ReportPlaybackTarget = {
  stationId?: string;
};

export type StationClient = {
  getStation: () => Promise<SdkPublicStation>;
  getSchemas: () => Promise<SdkPublicSchemaList>;
  getContent: (options: ContentListOptions) => Promise<SdkPublishedCollection>;
  getContentRecord: (id: string) => Promise<SdkPublishedRecord>;
  iterateContent: (
    options: Omit<ContentListOptions, "cursor">,
  ) => AsyncGenerator<SdkPublishedRecord>;
  getSchedule: (window: ScheduleWindow) => Promise<SdkPublicSchedule>;
  getPrograms: (window: ScheduleWindow) => Promise<SdkPublicPrograms>;
  getCurrentBroadcast: () => Promise<SdkPublicCurrentBroadcast>;
  getNowPlaying: () => Promise<SdkPublicNowPlaying>;
  getTrackHistory: (options?: TrackHistoryOptions) => Promise<SdkPublicTrackHistory>;
  iterateTrackHistory: (
    options?: Omit<TrackHistoryOptions, "cursor">,
  ) => AsyncGenerator<SdkPublicTrackHistory["items"][number]>;
  getWeather: () => Promise<SdkWeatherPublic | null>;
  getTraffic: () => Promise<SdkTrafficPublic | null>;
  /** Milliseconds from `station.delivery.pollIntervalSeconds`. */
  recommendedPollIntervalMs: () => Promise<number>;
  previewEditorial: (grant: string, input: SdkPreviewInput) => Promise<SdkRevisionPreview>;
  reportPlayback: (
    observation: SdkPlaybackObservation,
    target?: ReportPlaybackTarget,
  ) => Promise<SdkPlaybackObservationResult>;
  subscribe: (
    handlers: PublicSocketHandlers,
    window?: Partial<ScheduleWindow>,
  ) => PublicSocketSubscription;
};

function absoluteUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).href;
}

function requirePublicHref(href: string | null, name: string): string {
  if (!href) throw new Error(`Public ${name} API is unavailable for this station`);
  return href;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function assertScheduleWindow(window: ScheduleWindow): void {
  if (!isRealDate(window.fromDate) || !isRealDate(window.throughDate)) {
    throw new Error("Schedule dates must be YYYY-MM-DD");
  }
  const from = Date.parse(`${window.fromDate}T00:00:00.000Z`);
  const through = Date.parse(`${window.throughDate}T00:00:00.000Z`);
  const inclusiveDays = Math.round((through - from) / 86_400_000) + 1;
  if (inclusiveDays < 1 || inclusiveDays > 31) {
    throw new Error("Schedule window must cover 1 to 31 inclusive days");
  }
}

function useGraphql(options: CreateStationClientOptions): boolean {
  if (options.transport === "http") return false;
  if (options.transport === "graphql") return true;
  return options.graphql === true || options.transport === "auto";
}

export function createStationClient(options: CreateStationClientOptions): StationClient {
  const listenerToken = options.apiToken?.trim() ?? "";
  const ingestToken = options.ingestToken?.trim() ?? "";
  if (!listenerToken && !ingestToken) {
    throw new Error("A listener API token or playback ingest token is required");
  }
  if (!options.stationSlug.trim()) throw new Error("stationSlug is required");

  const stationPath = `/api/v1/stations/${encodeURIComponent(options.stationSlug)}`;
  const httpOptions: PublicJsonRequestOptions = {
    fetch: options.fetch,
    apiToken: listenerToken || undefined,
    etagCache: options.etagCache,
    cache: "no-store",
    credentials: "omit",
    retries: options.retries,
  };
  const graphqlEndpoint = absoluteUrl(options.baseUrl, `${stationPath}/graphql`);
  let stationCache: SdkPublicStation | null = null;

  const requireListenerToken = () => {
    if (!listenerToken) throw new Error("Listener API token (listener:read) is required");
  };

  async function preferGraphql<T>(graphql: () => Promise<T>, http: () => Promise<T>): Promise<T> {
    if (!useGraphql(options)) return http();
    try {
      return await graphql();
    } catch (error) {
      if (options.transport !== "auto" || !isGraphqlUnavailable(error)) throw error;
      return http();
    }
  }

  const loadStationHttp = async () => {
    const { data } = await readPublicJson(
      absoluteUrl(options.baseUrl, stationPath),
      sdkSchemas.PublicStation,
      httpOptions,
    );
    stationCache = data;
    return data;
  };

  const getStation = async (): Promise<SdkPublicStation> => {
    requireListenerToken();
    return preferGraphql(async () => {
      const data = await graphqlRequest<{ station: unknown }>(
        graphqlEndpoint,
        stationQuery,
        undefined,
        httpOptions,
      );
      stationCache = parseGraphqlStation(data);
      return stationCache;
    }, loadStationHttp);
  };

  const stationFor = async (resource: keyof SdkPublicStation["resources"], name: string) => {
    const station = stationCache ?? (await getStation());
    return { station, href: requirePublicHref(station.resources[resource], name) };
  };

  const optionalStationResource = async (resource: "weather" | "traffic") => {
    const station = stationCache ?? (await getStation());
    return station.resources[resource] ? station : null;
  };

  const getSchemas = async (): Promise<SdkPublicSchemaList> => {
    const { href } = await stationFor("schemas", "schemas");
    return preferGraphql(async () => {
      const data = await graphqlRequest<{ schemas: unknown[] }>(
        graphqlEndpoint,
        schemasQuery,
        undefined,
        httpOptions,
      );
      return parseGraphqlSchemas(data);
    }, async () => {
      const { data } = await readPublicJson(
        absoluteUrl(options.baseUrl, href),
        sdkSchemas.PublicSchemaList,
        httpOptions,
      );
      return data;
    });
  };

  const getContent = async (list: ContentListOptions): Promise<SdkPublishedCollection> => {
    const { href } = await stationFor("content", "content");
    const limit = list.limit ?? 25;
    const readHttp = async () => {
      const params = new URLSearchParams({ type: list.type, limit: String(limit) });
      if (list.cursor) params.set("cursor", list.cursor);
      for (const filter of list.filter ?? []) params.append("filter", filter);
      const { data } = await readPublicJson(
        absoluteUrl(options.baseUrl, `${href}?${params}`),
        sdkSchemas.PublishedCollection,
        httpOptions,
      );
      return data;
    };
    // The public GraphQL content field has no filter argument.
    if (list.filter?.length) return readHttp();
    return preferGraphql(
      async () => {
        const data = await graphqlRequest<{
          content: { records: unknown[]; nextCursor: string | null };
        }>(
          graphqlEndpoint,
          contentQuery,
          { type: list.type, cursor: list.cursor, limit },
          httpOptions,
        );
        return parseGraphqlContent(list.type, data, limit);
      },
      readHttp,
    );
  };

  const getContentRecord = async (id: string): Promise<SdkPublishedRecord> => {
    const { href } = await stationFor("content", "content");
    return preferGraphql(
      async () => {
        const data = await graphqlRequest<{ contentRecord: unknown }>(
          graphqlEndpoint,
          contentRecordQuery,
          { id },
          httpOptions,
        );
        return sdkSchemas.PublishedRecord.parse({
          contractVersion: 1,
          ...(data.contentRecord as object),
        });
      },
      async () => {
        const { data } = await readPublicJson(
          absoluteUrl(options.baseUrl, `${href}/${encodeURIComponent(id)}`),
          sdkSchemas.PublishedRecord,
          httpOptions,
        );
        return data;
      },
    );
  };

  async function* iterateContent(
    list: Omit<ContentListOptions, "cursor">,
  ): AsyncGenerator<SdkPublishedRecord> {
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await getContent({ ...list, cursor });
      for (const record of page.records) yield record;
      if (!page.nextCursor || seen.has(page.nextCursor)) return;
      seen.add(page.nextCursor);
      cursor = page.nextCursor;
    } while (cursor);
  }

  const getSchedule = async (window: ScheduleWindow): Promise<SdkPublicSchedule> => {
    assertScheduleWindow(window);
    const { href } = await stationFor("schedule", "schedule");
    return preferGraphql(
      async () => {
        const data = await graphqlRequest<{ schedule: unknown }>(
          graphqlEndpoint,
          scheduleQuery,
          window,
          httpOptions,
        );
        return parseGraphqlSchedule(data);
      },
      async () => {
        const params = new URLSearchParams(window);
        const { data } = await readPublicJson(
          absoluteUrl(options.baseUrl, `${href}?${params}`),
          sdkSchemas.PublicSchedule,
          httpOptions,
        );
        return data;
      },
    );
  };

  const getPrograms = async (window: ScheduleWindow): Promise<SdkPublicPrograms> => {
    assertScheduleWindow(window);
    const { href } = await stationFor("programs", "programs");
    return preferGraphql(
      async () => {
        const data = await graphqlRequest<{ programs: unknown }>(
          graphqlEndpoint,
          programsQuery,
          window,
          httpOptions,
        );
        return parseGraphqlPrograms(data);
      },
      async () => {
        const params = new URLSearchParams(window);
        const { data } = await readPublicJson(
          absoluteUrl(options.baseUrl, `${href}?${params}`),
          sdkSchemas.PublicPrograms,
          httpOptions,
        );
        return data;
      },
    );
  };

  const getCurrentBroadcast = async (): Promise<SdkPublicCurrentBroadcast> => {
    const { href } = await stationFor("broadcast", "broadcast");
    return preferGraphql(
      async () => {
        const data = await graphqlRequest<{ currentBroadcast: unknown }>(
          graphqlEndpoint,
          currentBroadcastQuery,
          undefined,
          httpOptions,
        );
        return parseGraphqlCurrentBroadcast(data);
      },
      async () => {
        const { data } = await readPublicJson(
          absoluteUrl(options.baseUrl, href),
          sdkSchemas.PublicCurrentBroadcast,
          httpOptions,
        );
        return data;
      },
    );
  };

  const getNowPlaying = async (): Promise<SdkPublicNowPlaying> => {
    const { href } = await stationFor("nowPlaying", "now-playing");
    return preferGraphql(
      async () => {
        const data = await graphqlRequest<{ nowPlaying: unknown }>(
          graphqlEndpoint,
          nowPlayingQuery,
          undefined,
          httpOptions,
        );
        return parseGraphqlNowPlaying(data);
      },
      async () => {
        const { data } = await readPublicJson(
          absoluteUrl(options.baseUrl, href),
          sdkSchemas.PublicNowPlaying,
          httpOptions,
        );
        return data;
      },
    );
  };

  const getTrackHistory = async (
    list: TrackHistoryOptions = {},
  ): Promise<SdkPublicTrackHistory> => {
    const { href } = await stationFor("trackHistory", "track-history");
    const limit = list.limit ?? 25;
    return preferGraphql(
      async () => {
        const data = await graphqlRequest<{ trackHistory: unknown }>(
          graphqlEndpoint,
          trackHistoryQuery,
          { cursor: list.cursor, limit },
          httpOptions,
        );
        return parseGraphqlTrackHistory(data);
      },
      async () => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (list.cursor) params.set("cursor", list.cursor);
        const { data } = await readPublicJson(
          absoluteUrl(options.baseUrl, `${href}?${params}`),
          sdkSchemas.PublicTrackHistory,
          httpOptions,
        );
        return data;
      },
    );
  };

  async function* iterateTrackHistory(
    list: Omit<TrackHistoryOptions, "cursor"> = {},
  ): AsyncGenerator<SdkPublicTrackHistory["items"][number]> {
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await getTrackHistory({ ...list, cursor });
      for (const item of page.items) yield item;
      if (!page.nextCursor || seen.has(page.nextCursor)) return;
      seen.add(page.nextCursor);
      cursor = page.nextCursor;
    } while (cursor);
  }

  const getWeather = async (): Promise<SdkWeatherPublic | null> => {
    const station = await optionalStationResource("weather");
    if (!station?.resources.weather) return null;
    const weatherHref = station.resources.weather;
    return preferGraphql(
      async () => {
        const data = await graphqlRequest<{ weather: unknown }>(
          graphqlEndpoint,
          weatherQuery,
          undefined,
          httpOptions,
        );
        return parseGraphqlWeather(data);
      },
      async () => {
        const { data } = await readPublicJson(
          absoluteUrl(options.baseUrl, weatherHref),
          sdkSchemas.WeatherPublic,
          httpOptions,
        );
        return data;
      },
    );
  };

  const getTraffic = async (): Promise<SdkTrafficPublic | null> => {
    const station = await optionalStationResource("traffic");
    if (!station?.resources.traffic) return null;
    const trafficHref = station.resources.traffic;
    return preferGraphql(
      async () => {
        const data = await graphqlRequest<{ traffic: unknown }>(
          graphqlEndpoint,
          trafficQuery,
          undefined,
          httpOptions,
        );
        return parseGraphqlTraffic(data);
      },
      async () => {
        const { data } = await readPublicJson(
          absoluteUrl(options.baseUrl, trafficHref),
          sdkSchemas.TrafficPublic,
          httpOptions,
        );
        return data;
      },
    );
  };

  return {
    getStation,
    getSchemas,
    getContent,
    getContentRecord,
    iterateContent,
    getSchedule,
    getPrograms,
    getCurrentBroadcast,
    getNowPlaying,
    getTrackHistory,
    iterateTrackHistory,
    getWeather,
    getTraffic,
    recommendedPollIntervalMs: async () =>
      (stationCache ?? (await getStation())).delivery.pollIntervalSeconds * 1000,
    previewEditorial: (grant, input) =>
      previewEditorial({
        baseUrl: options.baseUrl,
        grant,
        apiToken: listenerToken || undefined,
        input,
        fetch: options.fetch,
        transport: useGraphql(options) ? "graphql" : "http",
        stationSlug: options.stationSlug,
        retries: options.retries,
      }),
    reportPlayback: (observation, target) => {
      if (!ingestToken) throw new Error("Playback ingest token (ingest:write) is required");
      if (target?.stationId) {
        return reportPlayback({
          baseUrl: options.baseUrl,
          ingestToken,
          stationId: target.stationId,
          observation,
          fetch: options.fetch,
          retries: options.retries,
        });
      }
      return reportPlayback({
        baseUrl: options.baseUrl,
        ingestToken,
        stationSlug: options.stationSlug,
        observation,
        fetch: options.fetch,
        retries: options.retries,
      });
    },
    subscribe: (handlers, window) => {
      requireListenerToken();
      let inner: PublicSocketSubscription | null = null;
      let closed = false;
      void getStation()
        .then((station) => {
          if (closed) return;
          const socketUrl = requirePublicHref(station.resources.socket, "socket");
          inner = subscribePublicSocket({
            socketUrl,
            apiToken: listenerToken,
            createSocket: options.createSocket,
            radioToolsOrigin: options.baseUrl,
            fromDate: window?.fromDate,
            throughDate: window?.throughDate,
            handlers,
          });
        })
        .catch((error) => handlers.onError?.(error));
      return {
        close: () => {
          closed = true;
          inner?.close();
        },
      };
    },
  };
}

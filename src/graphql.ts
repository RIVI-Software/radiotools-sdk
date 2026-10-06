import type { PublicJsonRequestOptions } from "./http";
import { postJson, RadioToolsApiError } from "./http";
import { sdkSchemas } from "./schemas";

export type GraphqlRequestOptions = PublicJsonRequestOptions & {
  previewGrant?: string;
};

type GraphqlEnvelope<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
};

export async function graphqlRequest<TData>(
  endpoint: string,
  query: string,
  variables: Record<string, unknown> | undefined,
  options: GraphqlRequestOptions = {},
): Promise<TData> {
  const headers: Record<string, string> = {};
  if (options.apiToken) headers.authorization = `Bearer ${options.apiToken}`;
  if (options.previewGrant) headers["x-preview-grant"] = options.previewGrant;
  const body = await postJson<GraphqlEnvelope<TData>>(
    endpoint,
    { query, variables },
    { parse: (value) => value as GraphqlEnvelope<TData> },
    {
      fetch: options.fetch,
      headers,
      cache: options.cache ?? "no-store",
      credentials: options.credentials ?? "omit",
      retries: options.retries,
    },
  );
  if (body.errors?.length) {
    const code = body.errors[0]?.extensions?.code ?? "INTERNAL_ERROR";
    throw Object.assign(new Error(body.errors[0]?.message ?? "GraphQL error"), {
      name: "RadioToolsGraphqlError",
      code,
      errors: body.errors,
    });
  }
  if (!body.data) throw new Error("GraphQL response missing data");
  return body.data;
}

export function isGraphqlUnavailable(error: unknown): boolean {
  if (error instanceof RadioToolsApiError) return error.status === 404;
  return error instanceof Error && error.message.includes("(404)");
}

const broadcastFields = `
  id
  title
  startsAt
  endsAt
  timezone
  localDate
  resolution
  status
  cancellationReason
  repeatOfId
  program { id title profileId }
  presenters { id title }
`;

export const stationQuery = /* GraphQL */ `
  query SdkStation {
    station {
      contractVersion
      id
      slug
      name
      timezone
      publishingLanguage
      resources {
        schemas
        content
        schedule
        programs
        broadcast
        nowPlaying
        trackHistory
        socket
        weather
        traffic
        media
      }
      delivery { cache conditional pollIntervalSeconds }
    }
  }
`;

export const schemasQuery = /* GraphQL */ `
  query SdkSchemas {
    schemas { key label version archived fields }
  }
`;

export const contentQuery = /* GraphQL */ `
  query SdkContent($type: String!, $cursor: ID, $limit: Int) {
    content(type: $type, cursor: $cursor, limit: $limit) {
      nextCursor
      records {
        id
        publicationId
        revision
        type
        schemaVersion
        publishedAt
        values
        document
        media { assetId versionId kind url credits mime }
      }
    }
  }
`;

export const contentRecordQuery = /* GraphQL */ `
  query SdkContentRecord($id: ID!) {
    contentRecord(id: $id) {
      id
      publicationId
      revision
      type
      schemaVersion
      publishedAt
      values
      document
      media { assetId versionId kind url credits mime }
    }
  }
`;

export const nowPlayingQuery = /* GraphQL */ `
  query SdkNowPlaying {
    nowPlaying {
      contractVersion
      stationId
      timezone
      track {
        artist
        title
        album
        durationSeconds
        artworkUrl
        isPlaying
        observedAt
        receivedAt
      }
      elapsedSeconds
      endsAt
      freshness { status thresholdSeconds ageSeconds observedAt receivedAt }
    }
  }
`;

export const trackHistoryQuery = /* GraphQL */ `
  query SdkTrackHistory($cursor: String, $limit: Int) {
    trackHistory(cursor: $cursor, limit: $limit) {
      contractVersion
      stationId
      items {
        id
        artist
        title
        album
        durationSeconds
        artworkUrl
        isPlaying
        observedAt
        receivedAt
      }
      nextCursor
    }
  }
`;

export const scheduleQuery = /* GraphQL */ `
  query SdkSchedule($fromDate: String!, $throughDate: String!) {
    schedule(fromDate: $fromDate, throughDate: $throughDate) {
      contractVersion
      timezone
      truncated
      broadcasts { ${broadcastFields} }
    }
  }
`;

export const programsQuery = /* GraphQL */ `
  query SdkPrograms($fromDate: String!, $throughDate: String!) {
    programs(fromDate: $fromDate, throughDate: $throughDate) {
      contractVersion
      timezone
      fromDate
      throughDate
      truncated
      programs { id title profileId }
    }
  }
`;

export const currentBroadcastQuery = /* GraphQL */ `
  query SdkCurrentBroadcast {
    currentBroadcast {
      contractVersion
      timezone
      asOf
      broadcast { ${broadcastFields} }
    }
  }
`;

export const weatherQuery = /* GraphQL */ `
  query SdkWeather {
    weather { stationId timezone snapshots }
  }
`;

export const trafficQuery = /* GraphQL */ `
  query SdkTraffic {
    traffic { stationId snapshot }
  }
`;

export const previewMutation = /* GraphQL */ `
  mutation SdkPreview($input: PreviewInput!) {
    previewEditorial(input: $input) {
      id
      revision
      schemaVersion
      values
      document
      media { assetId versionId kind url credits mime }
    }
  }
`;

export function parseGraphqlStation(data: { station: unknown }) {
  return sdkSchemas.PublicStation.parse(data.station);
}

export function parseGraphqlSchemas(data: { schemas: unknown[] }) {
  return sdkSchemas.PublicSchemaList.parse({ contractVersion: 1, types: data.schemas });
}

export function parseGraphqlContent(
  type: string,
  data: { content: { records: unknown[]; nextCursor: string | null } },
  limit: number,
) {
  const nextCursor = data.content.nextCursor;
  return sdkSchemas.PublishedCollection.parse({
    contractVersion: 1,
    type,
    records: data.content.records.map((record) => ({
      contractVersion: 1,
      ...(record as object),
    })),
    nextCursor,
    page: { limit, nextCursor },
  });
}

export function parseGraphqlSchedule(data: { schedule: unknown }) {
  return sdkSchemas.PublicSchedule.parse(data.schedule);
}

export function parseGraphqlPrograms(data: { programs: unknown }) {
  return sdkSchemas.PublicPrograms.parse(data.programs);
}

export function parseGraphqlCurrentBroadcast(data: { currentBroadcast: unknown }) {
  return sdkSchemas.PublicCurrentBroadcast.parse(data.currentBroadcast);
}

export function parseGraphqlNowPlaying(data: { nowPlaying: unknown }) {
  return sdkSchemas.PublicNowPlaying.parse(data.nowPlaying);
}

export function parseGraphqlTrackHistory(data: { trackHistory: unknown }) {
  return sdkSchemas.PublicTrackHistory.parse(data.trackHistory);
}

export function parseGraphqlWeather(data: { weather: unknown }) {
  if (data.weather == null) return null;
  return sdkSchemas.WeatherPublic.parse({ contractVersion: 1, ...(data.weather as object) });
}

export function parseGraphqlTraffic(data: { traffic: unknown }) {
  if (data.traffic == null) return null;
  return sdkSchemas.TrafficPublic.parse({ contractVersion: 1, ...(data.traffic as object) });
}

export function parseGraphqlPreview(data: { previewEditorial: unknown }) {
  return sdkSchemas.RevisionPreview.parse(data.previewEditorial);
}

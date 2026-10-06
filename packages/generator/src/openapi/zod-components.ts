import { sdkSchemas } from "@rivi-software/radiotools-sdk";
import { z } from "zod";

export type OpenApiComponents = {
  schemas: Record<string, Record<string, unknown>>;
};

function stripMeta(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _, ...rest } = schema;
  return rest;
}

/** JSON Schema components generated from `@rivi-software/radiotools-sdk` Zod types (`sdkSchemas`). */
export function buildZodOpenApiComponents(): OpenApiComponents {
  const schemas: Record<string, Record<string, unknown>> = {};

  for (const [name, zodSchema] of Object.entries(sdkSchemas)) {
    const json = z.toJSONSchema(zodSchema, {
      io: "output",
      reused: "inline",
      unrepresentable: "any",
    }) as Record<string, unknown>;
    schemas[name] = stripMeta(json);
  }

  return { schemas };
}

export const operationResponseSchemas: Record<
  string,
  { schema: string; nullable?: boolean; description: string }
> = {
  getStation: { schema: "PublicStation", description: "Published station metadata" },
  getSchemas: { schema: "PublicSchemaList", description: "Content type schemas" },
  getContent: { schema: "PublishedCollection", description: "Published content page" },
  getContentRecord: { schema: "PublishedRecord", description: "One published record" },
  getSchedule: { schema: "PublicSchedule", description: "Broadcast schedule" },
  getPrograms: { schema: "PublicPrograms", description: "Program summaries" },
  getCurrentBroadcast: { schema: "PublicCurrentBroadcast", description: "Current broadcast" },
  getNowPlaying: { schema: "PublicNowPlaying", description: "Now playing" },
  getTrackHistory: { schema: "PublicTrackHistory", description: "Track history page" },
  getWeather: {
    schema: "WeatherPublic",
    nullable: true,
    description: "Weather snapshot when enabled",
  },
  getTraffic: {
    schema: "TrafficPublic",
    nullable: true,
    description: "Traffic snapshot when enabled",
  },
  reportPlayback: {
    schema: "PlaybackObservationResult",
    description: "Playback ingest acknowledgement",
  },
};

export function jsonSchemaRef(componentName: string): { $ref: string } {
  return { $ref: `#/components/schemas/${componentName}` };
}

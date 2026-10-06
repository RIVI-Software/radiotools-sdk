import { listenerSdkManifest } from "@rivi-software/radiotools-contract";
import {
  buildZodOpenApiComponents,
  jsonSchemaRef,
  operationResponseSchemas,
} from "../openapi/zod-components";
import type { SdkTarget } from "../types";

function errorResponseContent() {
  return {
    "application/json": {
      schema: jsonSchemaRef("ErrorResponse"),
    },
  };
}

function successResponse(operationId: string) {
  const mapping = operationResponseSchemas[operationId];
  if (!mapping) {
    return { description: "Success" };
  }
  const schema = jsonSchemaRef(mapping.schema);
  return {
    description: mapping.description,
    content: {
      "application/json": {
        schema: mapping.nullable ? { anyOf: [schema, { type: "null" }] } : schema,
      },
    },
  };
}

function renderOpenApi(): string {
  const manifest = listenerSdkManifest;
  const envDescriptions = Object.fromEntries(manifest.env.map((entry) => [entry.name, entry.description]));
  const zodComponents = buildZodOpenApiComponents();

  const paths: Record<string, unknown> = {
    "/api/v1/stations/{stationSlug}": {
      get: {
        operationId: "getStation",
        summary: "Published station metadata",
        tags: ["listener"],
        security: [{ bearerListener: [] }],
        parameters: [
          {
            name: "stationSlug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": successResponse("getStation"),
          "401": { description: "Missing or invalid listener token", content: errorResponseContent() },
          "404": { description: "Station not found", content: errorResponseContent() },
        },
      },
    },
    [manifest.integrations.playback.path]: {
      post: {
        operationId: "reportPlayback",
        summary: "Encoder playback observation",
        tags: ["ingest"],
        security: [{ bearerIngest: [] }],
        parameters: [
          {
            name: "stationSlug",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "stationId",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: jsonSchemaRef("PlaybackObservationIngestBody"),
            },
          },
        },
        responses: {
          "200": successResponse("reportPlayback"),
          "401": { description: "Missing or invalid ingest token", content: errorResponseContent() },
          "503": { description: "Temporary failure", content: errorResponseContent() },
        },
      },
    },
  };

  const queryParamsByOperation: Record<string, { name: string; schema: Record<string, unknown>; required?: boolean }[]> =
    {
      getContent: [
        { name: "type", required: true, schema: { type: "string" } },
        { name: "cursor", schema: { type: "string", format: "uuid" } },
        { name: "limit", schema: { type: "integer", minimum: 1, maximum: 50, default: 25 } },
      ],
      getSchedule: [
        { name: "fromDate", required: true, schema: { type: "string", format: "date" } },
        { name: "throughDate", required: true, schema: { type: "string", format: "date" } },
      ],
      getPrograms: [
        { name: "fromDate", required: true, schema: { type: "string", format: "date" } },
        { name: "throughDate", required: true, schema: { type: "string", format: "date" } },
      ],
      getTrackHistory: [
        { name: "cursor", schema: { type: "string" } },
        { name: "limit", schema: { type: "integer", minimum: 1, maximum: 50, default: 25 } },
      ],
    };

  for (const method of manifest.clientMethods) {
    if (!method.rest || method.rest.method !== "GET" || !method.rest.resourceKey) continue;
    if (method.name === "getStation") continue;

    const pathKey =
      method.rest.resourceKey === "content"
        ? `/api/v1/stations/{stationSlug}/content`
        : method.rest.resourceKey === "schemas"
          ? `/api/v1/stations/{stationSlug}/schemas`
          : `/api/v1/stations/{stationSlug}/${method.rest.resourceKey}`;

    const extraParams = queryParamsByOperation[method.name] ?? [];
    paths[pathKey] = {
      get: {
        operationId: method.name,
        summary: method.description,
        tags: ["listener"],
        security: [{ bearerListener: [] }],
        parameters: [
          { name: "stationSlug", in: "path", required: true, schema: { type: "string" } },
          ...extraParams.map((param) => ({
            name: param.name,
            in: "query" as const,
            required: param.required ?? false,
            schema: param.schema,
          })),
        ],
        responses: {
          "200": successResponse(method.name),
          "401": { description: "Unauthorized", content: errorResponseContent() },
          "404": { description: "Resource disabled or not found", content: errorResponseContent() },
        },
      },
    };

    if (method.name === "getContent") {
      paths[`/api/v1/stations/{stationSlug}/content/{id}`] = {
        get: {
          operationId: "getContentRecord",
          summary: "One published content record by id",
          tags: ["listener"],
          security: [{ bearerListener: [] }],
          parameters: [
            { name: "stationSlug", in: "path", required: true, schema: { type: "string" } },
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            "200": successResponse("getContentRecord"),
            "404": { description: "Not found", content: errorResponseContent() },
          },
        },
      };
    }
  }

  const doc = {
    openapi: "3.1.0",
    info: {
      title: "RadioTools Listener API",
      version: `${manifest.contractVersion}.0.0`,
      description:
        "OpenAPI generated from @rivi-software/radiotools-contract paths and @rivi-software/radiotools-sdk Zod schemas (sdkSchemas). Station resource hrefs may differ from these templates.",
    },
    servers: [
      {
        url: "{RADIOTOOLS_BASE_URL}",
        variables: { RADIOTOOLS_BASE_URL: { default: "https://radio.example" } },
      },
    ],
    tags: [
      { name: "listener", description: "Requires listener:read (RADIOTOOLS_API_TOKEN)" },
      { name: "ingest", description: "Requires ingest:write (RADIOTOOLS_INGEST_TOKEN)" },
    ],
    components: {
      securitySchemes: {
        bearerListener: {
          type: "http",
          scheme: "bearer",
          description: envDescriptions.RADIOTOOLS_API_TOKEN ?? "Station listener key",
        },
        bearerIngest: {
          type: "http",
          scheme: "bearer",
          description: envDescriptions.RADIOTOOLS_INGEST_TOKEN ?? "Playback ingest key",
        },
      },
      schemas: {
        ...zodComponents.schemas,
      },
    },
    paths,
    "x-radiotools": {
      contractVersion: manifest.contractVersion,
      socketProtocol: manifest.socketProtocol,
      zodSchemaSource: "@rivi-software/radiotools-sdk/schemas#sdkSchemas",
      graphqlSchema: "@rivi-software/radiotools-contract/graphql",
    },
  };

  return `${JSON.stringify(doc, null, 2)}\n`;
}

export const openapiTarget: SdkTarget = {
  id: "openapi",
  description: "OpenAPI 3.1 with components from Zod sdkSchemas (packages/openapi)",
  outputDir: (repoRoot) => `${repoRoot}/packages/openapi`,
  generate: () => [
    { path: "openapi.json", contents: renderOpenApi() },
    {
      path: "README.md",
      contents: `# RadioTools OpenAPI

\`openapi.json\` is generated from:

- REST paths in \`@rivi-software/radiotools-contract\`
- Response and request bodies from \`@rivi-software/radiotools-sdk\` **Zod** types (\`sdkSchemas\`) via \`z.toJSONSchema\`

\`\`\`bash
bun run --filter @rivi-software/radiotools-sdk-generator generate --target openapi
\`\`\`
`,
    },
  ],
};

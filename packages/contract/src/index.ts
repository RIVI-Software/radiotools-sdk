import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export {
  LISTENER_CONTRACT_VERSION,
  PUBLIC_SOCKET_PROTOCOL,
  listenerSdkManifest,
  type AuthScope,
  type SdkClientMethod,
  type SdkEnvVar,
  type SdkManifest,
} from "./manifest";

const packageDir = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the checked-in GraphQL schema for this contract version. */
export function graphqlSchemaPath(): string {
  return join(packageDir, "..", "graphql", "schema.graphql");
}

export function readGraphqlSchema(): string {
  return readFileSync(graphqlSchemaPath(), "utf8");
}

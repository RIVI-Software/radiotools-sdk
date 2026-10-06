# @rivi-software/radiotools-contract

The RadioTools listener API contract (v1): the source of truth the SDK generators read from. Station-facing routes only; studio administration is out of scope.

## Install

```bash
npm install @rivi-software/radiotools-contract
```

## What's inside

- `listenerSdkManifest`: the public client methods, auth scopes and environment variables.
- `LISTENER_CONTRACT_VERSION` and `PUBLIC_SOCKET_PROTOCOL`: version constants.
- `readGraphqlSchema()` and `graphqlSchemaPath()`: access to the checked-in GraphQL schema.
- `@rivi-software/radiotools-contract/graphql`: the raw `schema.graphql` file.

```ts
import { listenerSdkManifest, readGraphqlSchema } from "@rivi-software/radiotools-contract";

console.log(listenerSdkManifest);
const sdl = readGraphqlSchema();
```

Most applications want [`@rivi-software/radiotools-sdk`](../sdk-typescript) instead. Use this package when building tooling or a new SDK target.

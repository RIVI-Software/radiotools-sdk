<img src="assets/icon.svg" width="64" height="64" alt="">

# RadioTools SDK monorepo

Customer SDKs for **radio stations** using the RadioTools listener API (contract v1). Studio administration routes are out of scope.

## Packages

| Package | Description |
| --- | --- |
| [`@radiotools/contract`](packages/contract) | API manifest and GraphQL schema — source of truth for generators |
| [`@radiotools/sdk-generator`](packages/generator) | CLI to emit framework SDKs from the contract |
| [`@radiotools/sdk`](packages/sdk-typescript) | Full TypeScript client (REST, GraphQL, WebSocket, ETag, retries) |
| [`@radiotools/sdk-react`](packages/sdk-react) | React hooks (generated; wraps `@radiotools/sdk`) |
| [`@radiotools/sdk-vue`](packages/sdk-vue) | Vue composables (generated) |
| [`@radiotools/sdk-svelte`](packages/sdk-svelte) | Svelte stores (generated) |
| [`@radiotools/sdk-next`](packages/sdk-next) | Next.js App Router server helpers (generated) |
| [`radiotools-sdk`](packages/sdk-python) | Python `httpx` stubs (generated) |
| [`radiotools-sdk-go`](packages/sdk-go) | Go `net/http` stubs (generated) |
| [`RadioTools.Sdk`](packages/sdk-dotnet) | .NET `HttpClient` stubs (generated) |
| [`radiotools_sdk`](packages/sdk-ruby) | Ruby `Net::HTTP` stubs (generated) |
| [`radiotools/sdk`](packages/sdk-php) | PHP curl stubs (generated) |
| [`openapi.json`](packages/openapi) | OpenAPI 3.1 + JSON Schema from Zod `sdkSchemas` (generated) |
| [`sdk-kotlin`](packages/sdk-kotlin) | Kotlin/Android OkHttp stubs (generated) |
| [`RadioToolsSDK`](packages/sdk-swift) | Swift URLSession stubs (generated) |

## Development

```bash
bun install
bun run check
bun test
bun run generate
```

## Publish to npm

Publishable packages (fixed version group): `@radiotools/contract`, `@radiotools/sdk`, `@radiotools/sdk-react`, `@radiotools/sdk-vue`, `@radiotools/sdk-svelte`, `@radiotools/sdk-next`, `@radiotools/sdk-generator`.

### GitHub setup

1. Create an npm access token with **publish** rights to the `@radiotools` scope.
2. Add repository secret **`NPM_TOKEN`** ([Settings → Secrets → Actions](https://github.com/RIVI-Software/radiotools-sdk/settings/secrets/actions)).
3. Enable **npm provenance** for the org (recommended; workflows request `id-token: write`).

Default publish access is **`restricted`** (private to npm org). Use the manual workflow’s **public** option only if these packages should be public on npm.

### Automated release (Changesets)

On every push to `main`, [`.github/workflows/release-npm.yml`](.github/workflows/release-npm.yml) either opens a **Version packages** PR or publishes when that PR is merged:

```bash
bunx changeset          # describe the change
# merge the version PR from CI
# CI runs generate → build → test → npm publish
```

### Manual publish

[`.github/workflows/publish-npm-manual.yml`](.github/workflows/publish-npm-manual.yml) — **Actions → Publish npm (manual)**. Start with **dry run** enabled to validate tarballs.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and `main`: `generate`, typecheck, and tests.

Generate one target:

```bash
bun run --filter @radiotools/sdk-generator generate --target python
bun run --filter @radiotools/sdk-generator generate --target react
bun run --filter @radiotools/sdk-generator generate --target vue
bun run --filter @radiotools/sdk-generator generate --target openapi
# go, csharp, ruby, php, svelte — same pattern
```

List generator targets:

```bash
bun run --filter @radiotools/sdk-generator list-targets
```

## Adding a new SDK target

1. Extend [`packages/contract/src/manifest.ts`](packages/contract/src/manifest.ts) if the public surface changed.
2. Add a target module under [`packages/generator/src/targets/`](packages/generator/src/targets/) and register it in [`packages/generator/src/engine.ts`](packages/generator/src/engine.ts).
3. Add a `packages/sdk-<name>/` package for the emitted code and wire `bun run generate`.

## TypeScript SDK (`@radiotools/sdk`)

See [`packages/sdk-typescript`](packages/sdk-typescript) — usage is unchanged from the previous single-package layout.

### Credentials

Create keys in RadioTools under **Settings → API credentials**.

| Use | Credential | Scope |
| --- | --- | --- |
| Website, app, or player backend | Station key | `listener:read` |
| Encoder or automation | Integration key named `playback` | `ingest:write` |

Store them as `RADIOTOOLS_API_TOKEN` and `RADIOTOOLS_INGEST_TOKEN`. Pass the raw `rtm_…` value. The SDK adds the `Bearer ` prefix.

Also set `RADIOTOOLS_BASE_URL` and `RADIOTOOLS_STATION_SLUG`.

```ts
import { createStationClient, createStationClientFromEnv } from "@radiotools/sdk";

const client = createStationClientFromEnv();
```

Detailed examples for reads, playback ingest, and realtime remain in the TypeScript package sources and tests under `packages/sdk-typescript/`.

<img src="assets/icon.svg" width="64" height="64" alt="">

# RadioTools SDK monorepo

Customer SDKs for **radio stations** using the RadioTools listener API (contract v1). Studio administration routes are out of scope.

The TypeScript client is hand-written and complete (REST, GraphQL, WebSocket, ETag caching, retries, playback ingest). Everything else is generated from a single contract package, so every language and framework exposes the same surface.

Licensed under the [MIT License](LICENSE).

## Quick start

```bash
npm install @rivi-software/radiotools-sdk
```

```ts
import { createStationClientFromEnv } from "@rivi-software/radiotools-sdk";

const client = createStationClientFromEnv();
const nowPlaying = await client.getNowPlaying();
console.log(nowPlaying.track?.title);
```

See [Credentials](#credentials) for the environment variables. Using a framework? Pick the binding below: [React](packages/sdk-react), [Vue](packages/sdk-vue), [Svelte](packages/sdk-svelte) or [Next.js](packages/sdk-next).

## How it fits together

```
contract (manifest + GraphQL schema)
   └─ generator ─┬─ sdk-react / vue / svelte / next   (wrap the TypeScript client)
                 ├─ sdk-python / go / dotnet / ruby / php / kotlin / swift   (REST stubs)
                 └─ openapi.json                       (from Zod schemas)
```

Only the TypeScript package has GraphQL, WebSocket, ETag and retry support; the other language SDKs are minimal REST stubs.

## Packages

| Package | Description |
| --- | --- |
| [`@rivi-software/radiotools-contract`](packages/contract) | API manifest and GraphQL schema — source of truth for generators |
| [`@rivi-software/radiotools-sdk-generator`](packages/generator) | CLI to emit framework SDKs from the contract |
| [`@rivi-software/radiotools-sdk`](packages/sdk-typescript) | Full TypeScript client (REST, GraphQL, WebSocket, ETag, retries) |
| [`@rivi-software/radiotools-sdk-react`](packages/sdk-react) | React hooks (generated; wraps `@rivi-software/radiotools-sdk`) |
| [`@rivi-software/radiotools-sdk-vue`](packages/sdk-vue) | Vue composables (generated) |
| [`@rivi-software/radiotools-sdk-svelte`](packages/sdk-svelte) | Svelte stores (generated) |
| [`@rivi-software/radiotools-sdk-next`](packages/sdk-next) | Next.js App Router server helpers (generated) |
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

Publishable packages (fixed version group): `@rivi-software/radiotools-contract`, `@rivi-software/radiotools-sdk`, `@rivi-software/radiotools-sdk-react`, `@rivi-software/radiotools-sdk-vue`, `@rivi-software/radiotools-sdk-svelte`, `@rivi-software/radiotools-sdk-next`, `@rivi-software/radiotools-sdk-generator`.

### GitHub setup

1. Create an npm access token with **publish** rights to the `@rivi-software` scope.
2. Add repository secret **`NPM_TOKEN`** ([Settings → Secrets → Actions](https://github.com/RIVI-Software/radiotools-sdk/settings/secrets/actions)).
3. Enable **npm provenance** for the org (recommended; workflows request `id-token: write`).

Packages publish as **`public`** on npm (MIT license).

### Automated release (Changesets)

On every push to `main`, [`.github/workflows/release-npm.yml`](.github/workflows/release-npm.yml) either opens a **Version packages** PR or publishes when that PR is merged:

```bash
bunx changeset          # describe the change
# merge the version PR from CI
# CI runs generate → build → test → npm publish
```

### Manual publish

**From your machine** (no npm provenance — that needs GitHub Actions):

```bash
npm login   # or export NODE_AUTH_TOKEN=...
bash scripts/publish-npm-ordered.sh
```

**From GitHub Actions** — [`.github/workflows/publish-npm-manual.yml`](.github/workflows/publish-npm-manual.yml) sets `GITHUB_ACTIONS=true`, so the script adds `--provenance`. Start with **dry run** enabled to validate tarballs.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and `main`: `generate`, typecheck, and tests.

Generate one target:

```bash
bun run --filter @rivi-software/radiotools-sdk-generator generate --target python
bun run --filter @rivi-software/radiotools-sdk-generator generate --target react
bun run --filter @rivi-software/radiotools-sdk-generator generate --target vue
bun run --filter @rivi-software/radiotools-sdk-generator generate --target openapi
# go, csharp, ruby, php, svelte — same pattern
```

List generator targets:

```bash
bun run --filter @rivi-software/radiotools-sdk-generator list-targets
```

## Adding a new SDK target

1. Extend [`packages/contract/src/manifest.ts`](packages/contract/src/manifest.ts) if the public surface changed.
2. Add a target module under [`packages/generator/src/targets/`](packages/generator/src/targets/) and register it in [`packages/generator/src/engine.ts`](packages/generator/src/engine.ts).
3. Add a `packages/sdk-<name>/` package for the emitted code and wire `bun run generate`.

## TypeScript SDK (`@rivi-software/radiotools-sdk`)

See [`packages/sdk-typescript`](packages/sdk-typescript).

### Credentials

Create keys in RadioTools under **Settings → API credentials**.

| Use | Credential | Scope |
| --- | --- | --- |
| Website, app, or player backend | Station key | `listener:read` |
| Encoder or automation | Integration key named `playback` | `ingest:write` |

Store them as `RADIOTOOLS_API_TOKEN` and `RADIOTOOLS_INGEST_TOKEN`. Pass the raw `rtm_…` value. The SDK adds the `Bearer ` prefix.

Also set `RADIOTOOLS_BASE_URL` and `RADIOTOOLS_STATION_SLUG`.

```ts
import { createStationClient, createStationClientFromEnv } from "@rivi-software/radiotools-sdk";

const client = createStationClientFromEnv();
```

Examples for reads, realtime and playback ingest are in [`packages/sdk-typescript/README.md`](packages/sdk-typescript/README.md).

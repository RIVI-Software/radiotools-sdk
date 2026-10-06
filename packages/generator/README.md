# @rivi-software/radiotools-sdk-generator

CLI that emits the RadioTools SDKs (framework bindings, language stubs and OpenAPI) from [`@rivi-software/radiotools-contract`](../contract).

The generator writes into the `packages/sdk-*` directories of the [radiotools-sdk monorepo](https://github.com/RIVI-Software/radiotools-sdk), so it is meant to be run from a checkout of that repository.

## Usage

```bash
bun run generate                                                                   # all targets
bun run --filter @rivi-software/radiotools-sdk-generator generate --target python  # one target
bun run --filter @rivi-software/radiotools-sdk-generator list-targets
```

## Targets

`react`, `vue`, `svelte`, `next`, `python`, `go`, `csharp`, `ruby`, `php`, `kotlin`, `swift`, `openapi`. Run `list` for the current set.

| Flag | Description |
| --- | --- |
| `--target <id\|all>` | Which target to generate (default `all`) |
| `--dry-run` | Report what would be written without touching files |

## Adding a target

Add a module under `src/targets/`, register it in `src/engine.ts`, and add the matching `packages/sdk-<name>/` output directory.

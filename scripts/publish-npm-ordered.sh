#!/usr/bin/env bash
# Publish @rivi-software/* packages in dependency order (after changeset version bumps).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PACKAGES=(
  "@rivi-software/radiotools-contract"
  "@rivi-software/radiotools-sdk"
  "@rivi-software/radiotools-sdk-react"
  "@rivi-software/radiotools-sdk-vue"
  "@rivi-software/radiotools-sdk-svelte"
  "@rivi-software/radiotools-sdk-next"
  "@rivi-software/radiotools-sdk-generator"
)

DRY_RUN="${DRY_RUN:-false}"
ACCESS="${NPM_PUBLISH_ACCESS:-restricted}"

# npm provenance requires GitHub Actions OIDC — not available for local publishes.
PROVENANCE_ARGS=()
if [[ "${NPM_PROVENANCE:-}" == "true" ]] || [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  PROVENANCE_ARGS=(--provenance)
fi

for name in "${PACKAGES[@]}"; do
  echo "Publishing ${name} (access=${ACCESS})…"
  if [[ "$DRY_RUN" == "true" ]]; then
    npm publish -w "$name" --access "$ACCESS" --dry-run
  else
    npm publish -w "$name" --access "$ACCESS" "${PROVENANCE_ARGS[@]}"
  fi
done

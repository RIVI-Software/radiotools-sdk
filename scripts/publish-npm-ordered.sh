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
ACCESS="${NPM_PUBLISH_ACCESS:-public}"

# npm provenance requires GitHub Actions OIDC — not available for local publishes.
use_provenance=false
if [[ "${NPM_PROVENANCE:-}" == "true" ]] || [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  use_provenance=true
fi

for name in "${PACKAGES[@]}"; do
  echo "Publishing ${name} (access=${ACCESS})…"
  if [[ "$DRY_RUN" == "true" ]]; then
    npm publish -w "$name" --access "$ACCESS" --dry-run
  elif [[ "$use_provenance" == "true" ]]; then
    npm publish -w "$name" --access "$ACCESS" --provenance
  else
    npm publish -w "$name" --access "$ACCESS"
  fi
done

#!/usr/bin/env bash
# Publish @radiotools/* packages in dependency order (after changeset version bumps).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PACKAGES=(
  "@radiotools/contract"
  "@radiotools/sdk"
  "@radiotools/sdk-react"
  "@radiotools/sdk-vue"
  "@radiotools/sdk-svelte"
  "@radiotools/sdk-next"
  "@radiotools/sdk-generator"
)

DRY_RUN="${DRY_RUN:-false}"
ACCESS="${NPM_PUBLISH_ACCESS:-restricted}"

for name in "${PACKAGES[@]}"; do
  echo "Publishing ${name} (access=${ACCESS})…"
  if [[ "$DRY_RUN" == "true" ]]; then
    npm publish -w "$name" --access "$ACCESS" --dry-run
  else
    npm publish -w "$name" --access "$ACCESS" --provenance
  fi
done

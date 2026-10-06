# Changesets

When a PR should trigger an npm release, add a changeset:

```bash
bunx changeset
```

Merge the version PR created by the release workflow (or run `bun run version` locally), then the release workflow publishes to npm.

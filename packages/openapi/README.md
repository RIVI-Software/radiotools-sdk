# RadioTools OpenAPI

`openapi.json` is generated from:

- REST paths in `@rivi-software/radiotools-contract`
- Response and request bodies from `@rivi-software/radiotools-sdk` **Zod** types (`sdkSchemas`) via `z.toJSONSchema`

```bash
bun run --filter @rivi-software/radiotools-sdk-generator generate --target openapi
```

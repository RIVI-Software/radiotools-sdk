# RadioTools OpenAPI

`openapi.json` is generated from:

- REST paths in `@radiotools/contract`
- Response and request bodies from `@radiotools/sdk` **Zod** types (`sdkSchemas`) via `z.toJSONSchema`

```bash
bun run --filter @radiotools/sdk-generator generate --target openapi
```

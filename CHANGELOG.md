# Changelog

## 2.0.0

Security hardening for the standalone AEM 6.5 MCP server.

- Sling JSON reads use `{path}.{n}.json` selectors (`getJson`). AEM 6.5 ignores `?:depth=`.
- Version history uses `GET /bin/wcm/versions.json?path=`.
- QueryBuilder pagination reads `more` (not `hasMore`); `p.guessTotal` totals are not treated as complete.
- Workflow models parse JSON `{uri}` arrays and Sling `{uri}[]` keys from `/var/workflow/models.json`.
- HTTP `/api/methods/:name` returns `AemError.statusCode` (disabled tools 403). `toJSON()` includes `statusCode`.
- `startWorkflow` returns `instancePath` from Location or the response body.
- `/bin/replicate.json` fails closed when the Author body shows agent/connection errors; otherwise success includes an agent/queue warning when queue details are absent.

- Sling POST property names are allowlisted (`^[a-zA-Z][a-zA-Z0-9:_-]*$`); keys starting with `:` or containing `@` are rejected. `createPage` extras cannot overwrite `cmd`, `parentPath`, `title`, `label`, or `template`.
- Component `resourceType` is resolved from a configured type map. Arbitrary resource types and `parentPath` values outside the page `jcr:content` tree are rejected.
- `ifMatch` fails closed with 409 when the component has no last-modified stamp.
- Workflow instance and model paths are canonical JCR paths under known roots; encoded traversal is rejected.
- CSRF retry applies only to Granite CSRF 403s, then fails closed as `CSRF_FAILED`. ACL 403s are not retried and do not open the circuit breaker.
- Asset metadata keys use the same Sling name allowlist. Uploads require an allowed MIME type (no silent `application/octet-stream`).
- HTTP mode requires `MCP_API_KEY` or Basic credentials in every environment. `/health/live` stays unauthenticated and skips Host/rate-limit guards.
- Docker binds `HOST=0.0.0.0` inside the container only; local default remains `127.0.0.1`. TLS proxy is required.
- MCP SDK pinned to `^1.30.0`. JSON body limit covers base64 uploads. Idempotency is singleflight in-process (not shared across replicas).
- Dashboard tool-runner and sessionStorage credential UI removed.
- Timing-safe comparison for API key and Basic password.

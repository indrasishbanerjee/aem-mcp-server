# Threat model

## System and trust boundaries

```
IDE / LLM client  --stdio-->  MCP Node process  --HTTP Basic+CSRF-->  AEM 6.5 Author
Browser / automation --HTTPS+API key/Basic--> HTTP gateway --same--> Author
```

The LLM and any MCP client are **untrusted**. They can call every enabled tool with any arguments the schema accepts. The Node process is the enforcement point for path policy, predicate allowlists, property filters, size limits, and authentication. AEM ACLs are the second enforcement point and must not be the only one.

## Assets

- AEM repository content (pages, assets, workflow state)
- Technical-user credentials in process environment
- Optional HTTP API key / Basic password
- Tool arguments that may contain page copy, paths, or base64 binaries

## Controls

| Threat | Control |
| --- | --- |
| Unauthenticated remote mutation | Every HTTP route except `/health/live` requires API key or Basic in production; `/api/methods/:name` is authenticated |
| Default credentials | No `admin/admin` fallback; production refuses those values |
| Path escape (`/content-evil`, `..`, encoded slashes) | Segment-canonicalized JCR paths and prefix roots |
| Prompt-driven JCR dump | No `.infinity.json`; bounded depth; `getNodeContent` disabled |
| QueryBuilder injection | Predicate allowlist; path clamp; limit clamp |
| CSRF bypass | Granite token required; fail closed after one retry |
| Binary exfil via logs | Redaction of secrets, cookies, fileContent, large strings |
| SSRF / host confusion | `ALLOWED_HOSTS` / Origin checks; AEM host from config only |
| Tree publish accidents | `activateTree` / `deep` rejected |
| Fake rollback | Bulk updates report per-item state only |
| Supply chain | Lockfile required; `npm audit` in CI; unused AI SDKs removed |
| LLM over-broad writes | Component-type and writable-property allowlists; optional `ifMatch` |

## Residual risk

- A compromised technical user can mutate every path that user can write in AEM. Scope ACLs tightly.
- Stdio MCP has no per-call end-user identity; treat the IDE user as the principal.
- Contract tests without a live Author cannot prove service-pack quirks. Do not enable quarantined tools against production.
- Streamable HTTP is optional and must sit behind TLS. Binding `0.0.0.0` without a proxy is unsafe.

# Operations runbook

This MCP server is a standalone Node.js process. Do not install OSGi bundles, content packages, RepoInit, or custom servlets on AEM.

## Author URL access

1. Point `AEM_HOST` at the Author base URL that this host can reach (for example `https://author.example.com`).
2. Confirm Dispatcher or reverse proxy allows:
   - `GET /libs/granite/csrf/token.json`
   - `GET /bin/querybuilder.json`
   - `POST /bin/wcmcommand`
   - `POST /bin/replicate.json`
   - `POST *.createasset.html`
   - `POST /etc/workflow/instances`
   - bounded `.json` selectors on `/content`, `/content/dam`, `/conf`
3. Do not expose Author anonymously. This process authenticates with HTTP Basic as the technical user.

## Technical user

Create a user in AEM User Admin (not an OSGi service user mapping). Grant the ACLs in [AEM_ACL_CHECKLIST.md](AEM_ACL_CHECKLIST.md). Set:

```
AEM_HOST=https://author.example.com
AEM_SERVICE_USER=mcp-technical
AEM_SERVICE_PASSWORD=<from secret store>
```

Production and staging refuse `admin` / `admin`. Rotate the password if it ever appeared in git (the historical `.env` used local defaults).

## CSRF

Mutating calls fetch `GET /libs/granite/csrf/token.json` and send `CSRF-Token`. A 403 CSRF response is retried once with a fresh token, then fails closed. There is no fallback that skips CSRF.

## HTTP MCP (optional)

Stdio is enough for IDE clients:

```json
{
  "mcpServers": {
    "aem": {
      "command": "node",
      "args": ["dist/mcp/stdio.js"],
      "env": {
        "AEM_HOST": "http://localhost:4502",
        "AEM_SERVICE_USER": "mcp-technical",
        "AEM_SERVICE_PASSWORD": "<secret>"
      }
    }
  }
}
```

If you enable HTTP (`npm start`):

- Require `MCP_API_KEY` or `MCP_USERNAME` / `MCP_PASSWORD`.
- Put TLS and a reverse proxy in front of the process. Bind `HOST=127.0.0.1` unless the proxy is local.
- Set `ALLOWED_HOSTS` and `CORS_ORIGINS`. Empty CORS means browsers are denied.
- Liveness: unauthenticated `GET /health/live`. Readiness and diagnostics require auth.

Streamable HTTP example:

```
curl -sS -H "X-API-Key: $MCP_API_KEY" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"ops","version":"0"}}}' \
  http://127.0.0.1:3001/mcp
```

## Key rotation

1. Create a new AEM technical user or change the password in User Admin.
2. Update the secret store / environment.
3. Restart the Node process (credentials are read at startup).
4. Rotate `MCP_API_KEY` independently; HTTP clients must be updated in the same change window.

## Upgrade compatibility

- Node 20 or 22 LTS only.
- After upgrading AEM service packs, run contract tests (`npm test`) and, when Author is available, `AEM_INTEGRATION=1 npm test`.
- Do not enable quarantined tools without a proven OOTB HTTP contract on that service pack.

## Backup / restore

This process stores no JCR content. Backup Author as usual. Idempotency keys are in-memory and vanish on restart. Audit logs, if file logging is enabled, live under `LOG_DIRECTORY`.

## Audit retention

Structured logs include correlation id, tool name, risk, duration, and outcome. Credentials, cookies, binaries, and AEM error HTML are redacted. Retain according to your organization’s audit policy; the server does not ship a log warehouse.

## Incident containment

1. Disable HTTP at the proxy or stop the process (`SIGINT` drains the listener).
2. Disable or lock the AEM technical user.
3. Rotate `MCP_API_KEY` if HTTP was exposed.
4. Review Author audit (`cq:lastModifiedBy`, replication, workflow instances) for the technical user.
5. Do not “roll back” via this server; restore from Author backup if repository repair is required.

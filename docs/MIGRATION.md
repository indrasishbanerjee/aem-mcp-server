# Versioning and deprecation

## Semantic versioning

- **Major**: removed or incompatible tool names, authentication changes, or AEM contracts that existing clients relied on.
- **Minor**: new enabled tools, new optional arguments, additional supported 6.5 service packs.
- **Patch**: fixes, tighter validation, documentation.

This line is **2.x pre-production**. Treat 2.0.0 as an incompatible rewrite of the 1.x prototype (stdio path, HTTP transport, and AEM endpoints all changed).

## Deprecation policy

1. Tools are disabled in the catalog before they are deleted.
2. Disabled tools remain documented in the capability matrix with a reason.
3. Re-enabling a tool requires contract tests on the minimum and current supported AEM 6.5 service packs.

## Migration from 1.x prototype

| 1.x | 2.x |
| --- | --- |
| `node dist/mcp-server.js` | `node dist/mcp/stdio.js` (`npm run mcp`) |
| Custom `POST /mcp` JSON-RPC | MCP SDK Streamable HTTP |
| Unauthenticated `POST /api/methods/:name` | API key or Basic required outside local development |
| `AEM_SERVICE_USER` default `admin` | Required env; no defaults; production rejects `admin` |
| `.infinity.json` / `getNodeContent` | `getPageContent` with `:depth` |
| DAM URL-encoded base64 node create | `{parent}.createasset.html` multipart |
| Workflow JSON body | form `model`, `payloadType`, `payload` |
| `deep=true` tree replicate | rejected |
| OpenAI / Anthropic / Telegram | removed |

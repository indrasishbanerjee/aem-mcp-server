# AEM 6.5 MCP Server

Standalone Node.js [Model Context Protocol](https://modelcontextprotocol.io/) server for **Adobe Experience Manager 6.5 Author**. It does not install anything on AEM.

**Status: pre-production.** Use the [capability matrix](docs/CAPABILITY_MATRIX.md) as the list of supported operations. Release gates are in [docs/adr/0001-standalone-http-mcp.md](docs/adr/0001-standalone-http-mcp.md).

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-blue.svg)](https://nodejs.org/)
[![AEM](https://img.shields.io/badge/AEM-6.5%20SP17%2B-blue.svg)](https://experienceleague.adobe.com/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

This project is AGPL-3.0 for open source use. Commercial licensing is described in [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

AEMaaCS is a different product: see [aemaacs-mcp-server](https://github.com/indrasishbanerjee/aemaacs-mcp-server). AEM 6.5 LTS is out of scope.

## What this is

- MCP **stdio** for IDE clients (primary).
- Optional MCP **Streamable HTTP** (`POST /mcp`) with API key or HTTP Basic. **OAuth is out of scope.**
- One typed tool catalog driving both transports.
- Documented AEM 6.5 HTTP only: Granite CSRF, `/bin/wcmcommand`, `/bin/replicate.json`, QueryBuilder, Assets `createasset.html`, Workflow REST.

## What this is not

- Production-ready until CI gates and live Author contract tests pass.
- An AEM package, OSGi service, or RepoInit installer.
- Atomic bulk rollback, JCR-SQL2, MSM rollout, tree activation, or `.infinity.json` dumps.
- An OpenAI/Anthropic/Telegram bot.

## Requirements

- Node.js 20 or 22
- AEM 6.5 Author SP17+ reachable over HTTP(S)
- A technical user that already exists in AEM User Admin ([ACL checklist](docs/AEM_ACL_CHECKLIST.md))

## Quick start (stdio)

```bash
cp .env.example .env
# set AEM_HOST, AEM_SERVICE_USER, AEM_SERVICE_PASSWORD
npm ci
npm run build
npm run mcp
```

Cursor / Claude desktop config:

```json
{
  "mcpServers": {
    "aem-65": {
      "command": "node",
      "args": ["/absolute/path/to/dist/mcp/stdio.js"],
      "env": {
        "AEM_HOST": "http://localhost:4502",
        "AEM_SERVICE_USER": "mcp-technical",
        "AEM_SERVICE_PASSWORD": "<secret>"
      }
    }
  }
}
```

## Optional HTTP gateway

```bash
export MCP_API_KEY=replace-me
export HTTP_ENABLED=true
npm start
```

- Liveness (no auth): `GET /health/live`
- Readiness (auth): `GET /health/ready`
- MCP: `POST /mcp` (SDK Streamable HTTP)
- Convenience REST: `GET /api/methods`, `POST /api/methods/:name` (same auth; not a substitute for MCP)

Put TLS in front. Bind `HOST=127.0.0.1`. Set `ALLOWED_HOSTS` and `CORS_ORIGINS`.

```bash
curl -sS -H "X-API-Key: $MCP_API_KEY" http://127.0.0.1:3001/api/methods
```

## Configuration

See `.env.example`. Required: `AEM_HOST`, `AEM_SERVICE_USER`, `AEM_SERVICE_PASSWORD`. Production/staging refuse `admin`/`admin` and refuse HTTP without API key or Basic.

Default page resource type is `core/wcm/components/page/v3/page`. Override with `AEM_DEFAULT_PAGE_RESOURCE_TYPE` and `AEM_DEFAULT_CONTAINER` for your project.

## Architecture

```
MCP client → stdio or Streamable HTTP → typed tool catalog
  → validation / path policy / audit → AEM 6.5 HTTP adapter → Author
```

Details: [capability matrix](docs/CAPABILITY_MATRIX.md), [tool reference](docs/TOOLS.md), [operations](docs/OPERATIONS.md), [threat model](docs/THREAT_MODEL.md), [1.x migration](docs/MIGRATION.md).

## Development

```bash
npm ci
npm run lint
npm test
npm run build
```

Live Author tests (optional): `AEM_INTEGRATION=1 npm test`.

## License

AGPL-3.0-or-later. Contact via [LinkedIn](https://www.linkedin.com/in/indrasish/) for commercial licensing.

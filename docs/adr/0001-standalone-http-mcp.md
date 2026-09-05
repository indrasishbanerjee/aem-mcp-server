# ADR 0001: Standalone AEM 6.5 HTTP MCP server

- Status: Accepted
- Date: 2026-09-05

## Context

The previous codebase was a prototype with two MCP-shaped surfaces, guessed AEM endpoints, default `admin/admin` credentials, and claims of production readiness. Operators of AEM 6.5 estates cannot install custom OSGi bundles or content packages solely to enable an LLM tool host.

## Decision

1. This repository remains a **standalone Node.js process**. It talks to stock AEM 6.5 Author over documented HTTP APIs (Sling POST, QueryBuilder, `/bin/wcmcommand`, `/bin/replicate.json`, Granite CSRF, Assets create-asset, Workflow REST). No OSGi bundle, content package, RepoInit script, or custom servlet is shipped or required.
2. **Stdio is the primary MCP transport.** Optional HTTP uses the MCP SDK Streamable HTTP transport with API key or HTTP Basic. OAuth, authorization-server metadata, and token issuance are out of scope.
3. The product is **pre-production** until the release gates in this repository pass on each supported AEM 6.5 baseline. Unsupported or unproven tools stay disabled rather than being papered over with a custom AEM façade.
4. Authentication to AEM uses a dedicated technical user via HTTP Basic. That user is created in AEM User Admin; this project does not claim OSGi service-user mapping.

## Support matrix (declared)

| Item | Supported | Notes |
| --- | --- | --- |
| AEM product | AEM 6.5 on-premise / AMS Author | AEM 6.5 LTS and AEMaaCS are out of scope |
| Service packs | 6.5.17 (minimum) through current 6.5.22+ service packs | Contract tests must pass on min and current |
| Java on Author | Java 11 or Java 17 as required by the installed service pack | Not runtime of this server |
| Topology | Single Author; optional publish farm via replication agents | This process talks to Author only |
| Dispatcher | Must allow the documented Author HTTP APIs from this host | No Dispatcher bypass hacks |
| Core Components | 2.x baseline, project resource types configured | No `foundation/components/page` default |
| MCP SDK | Current `@modelcontextprotocol/sdk` Streamable HTTP + stdio | Custom JSON-RPC is not MCP |
| Node.js | 20 LTS or 22 LTS | 18 is unsupported |
| Identity | AEM technical user (Basic); optional HTTP API key or Basic | No OAuth |

## Consequences

- Tools without a proven OOTB HTTP contract are disabled in the catalog.
- Documentation must not claim atomic rollback, connection pooling completeness, or “production-ready” until gates pass.
- Operators configure `AEM_HOST` plus a technical user that already exists in AEM.

# AEM 6.5 MCP capability matrix

This matrix is the source of truth for README claims. Enabled means the tool is registered, uses a documented AEM 6.5 HTTP API, and has contract tests. Disabled tools are not advertised to MCP clients.

Legend: **enabled** = registered; **disabled** = quarantined; **bounded** = depth/limit/path policy applied.

## Pages

| Tool | Status | AEM contract | Bounds / notes |
| --- | --- | --- | --- |
| listPages | enabled | QueryBuilder `type=cq:Page`, `p.guessTotal` | Clamped limit; `p.nodedepth` is not treated as descendant search depth |
| getPageProperties | enabled | `{page}/jcr:content.json` | Selected properties only |
| getPageContent | enabled | `{page}.json` `? :depth=` | No `.infinity.json` |
| getAllTextContent / getPageTextContent | enabled | bounded `.json` walk | Title/text/description only |
| getPageImages | enabled | bounded `.json` walk | fileReference/src only |
| createPage | enabled | `POST /bin/wcmcommand` `cmd=createPage` | Template must exist; naming sanitized |
| deletePage | enabled | `POST /bin/wcmcommand` `cmd=deletePage` | Destructive |
| activatePage / deactivatePage | enabled | `POST /bin/replicate.json` | Tree/deep activation rejected |
| unpublishContent | enabled | per-path deactivate | `unpublishTree` rejected |

## Components

| Tool | Status | AEM contract | Bounds / notes |
| --- | --- | --- | --- |
| createComponent | enabled | Sling POST under `jcr:content/{container}` | Component-type allowlist; writable properties only |
| updateComponent | enabled | Sling POST | Optional `ifMatch` last-modified precondition |
| deleteComponent | enabled | Sling POST `:operation=delete` | Destructive |
| scanPageComponents | enabled | bounded `.json` | No raw subtree dump of protected properties |
| bulkUpdateComponents | enabled | sequential Sling POST | Per-item results; **no rollback claim** |
| updateImagePath | enabled | Sling POST `fileReference` | Path must be inside allowed roots |
| validateComponent | disabled | — | Previous check was a locale allowlist, not dialog validation |

## Assets

| Tool | Status | AEM contract | Bounds / notes |
| --- | --- | --- | --- |
| uploadAsset | enabled | `{parent}.createasset.html` multipart | Base64 decode; size/name/MIME limits; no `/api/assets` |
| updateAsset | enabled | Sling POST metadata | Binary replace not supported |
| deleteAsset | enabled | Sling POST delete | Destructive |
| getAssetMetadata | enabled | `{asset}/jcr:content/metadata.json` | Metadata only |

## Search and discovery

| Tool | Status | AEM contract | Bounds / notes |
| --- | --- | --- | --- |
| searchContent | enabled | QueryBuilder | Predicate allowlist, path clamp, `p.guessTotal` |
| enhancedPageSearch | enabled | QueryBuilder fallbacks | No We.Retail hardcoding |
| fetchSites / fetchLanguageMasters / fetchAvailableLocales | enabled | bounded `.json` children | Configured sites root |
| listChildren | enabled | `:depth=1` | Direct children |
| getTemplates / getTemplateStructure | enabled | `/conf` JSON | Bounded depth; Core Components / project types from config |
| executeJCRQuery | disabled | — | Was not JCR-SQL2 |
| getNodeContent | disabled | — | Unbounded JCR dump risk |

## Workflows and versions

| Tool | Status | AEM contract | Bounds / notes |
| --- | --- | --- | --- |
| startWorkflow | enabled | `POST /etc/workflow/instances` form `model`, `payloadType=JCR_PATH`, `payload` | Payload path must be allowed |
| getStatus / listActiveWorkflows | enabled | instance JSON / QueryBuilder | RUNNING filter |
| cancel / suspend / resume | enabled | POST `state=` on instance | Instance path sanitized |
| getWorkflowModels | enabled | `/var`, `/conf`, `/etc` model roots | Best-effort list |
| completeWorkflowStep | disabled | — | Inbox work-item IDs not proven |
| getVersionHistory | enabled | `{path}.versionhistory.json` | Bounded depth |
| createVersion / restoreVersion | enabled | `/bin/wcmcommand` | No fabricated version IDs |
| deleteVersion / compareVersions | disabled | — | No documented public servlet used here |

## Intentionally unavailable

| Tool | Reason |
| --- | --- |
| replicateAndPublish (MSM rollout) | Locale/MSM topology is not a safe generic HTTP façade |
| undoChanges | No verified compensating transaction |
| Tree activation (`deep=true`) | Not equivalent to Manage Publication tree activation |

## Transports

| Transport | Status | Auth |
| --- | --- | --- |
| MCP stdio | primary | AEM technical user in process env |
| MCP Streamable HTTP `POST /mcp` | optional | API key or HTTP Basic |
| REST `POST /api/methods/:name` | optional convenience | Same as HTTP MCP; not a substitute for MCP |
| Custom JSON-RPC masquerading as MCP | removed | — |
| OAuth / bearer resource server | out of scope | — |

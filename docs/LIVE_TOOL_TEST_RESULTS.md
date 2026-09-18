# Live MCP tool test results

## Fix retest — 2026-09-14 (after P0/P1/P2)

**Branch:** `cursor/aem-mcp-modernization-842e`  
**Transport:** `dist/` catalog handlers, Author `http://localhost:4502` `admin`/`admin`. HTTP 403 proved in-process on `createApp` (not the `.env` `:3001` gateway).  
**Throwaway:** `/content/mcp-test-20260914` created, versioned, activated, used as workflow payload, then **deleted**. We.Retail was read-only.

### Unit tests

`npm test`: **9 suites, 59 passed, 1 skipped**.

### Targeted live retest (previously failing tools)

| Tool | Verdict | Notes |
| --- | --- | --- |
| fetchSites | pass | includes `we-retail` among `/content` children |
| fetchLanguageMasters | pass | `language-masters, us, ca, ch, de, fr, es, it, resources` |
| fetchAvailableLocales | pass | `/content/we-retail/us` → `en, es` |
| listChildren | pass | 9 children (`language-masters`, `us`, …) |
| listPages `more` | pass | `limit=5` → `more=true`, `pageCount=5` |
| getPageContent | pass | `jcr:content` present at `.2.json` |
| getAllTextContent | pass | `textContent=1` |
| getPageImages | partial | `images=0` on We.Retail home (scan found 23 components; no `fileReference`/`src` at this depth) |
| scanPageComponents | pass | 23 components |
| getTemplates | pass | 10 templates (`hero-page`, …) |
| getTemplateStructure | pass | `properties`, `structure`, `initial`, `policies` |
| getVersionHistory | pass | `/bin/wcm/versions.json`; throwaway listed version `mcp-live-20260914` |
| getWorkflowModels | pass | **55** models from `/var/workflow/models.json` |
| HTTP `executeJCRQuery` | pass | **403** `TOOL_DISABLED` (was 400) |
| startWorkflow | pass | `instancePath=/var/workflow/instances/server0/2026-09-13/request_for_activation_12` |
| cancelWorkflow | pass | cancelled that instance |
| activatePage | pass | Author 200 + **agent/queue warning** (body had no visible 4503 error; Publish still down) |
| createPage / createVersion / deletePage | pass | throwaway lifecycle |

**Live retest counts:** 18 pass, 1 partial (`getPageImages`). Extra discovery reads (language masters/locales) also pass.

**Implied 47-tool board after this retest:** pass 43 (incl. 8 disabled), fail 0, partial 1 (`getPageImages`), skip 3 (`suspendWorkflow`, `resumeWorkflow`, `restoreVersion` — not re-run). Previously passing write tools (components/assets/search) were not re-executed.

### Leftover

- `getPageImages` still empty on `/content/we-retail/us/en` (content shape, not `:depth`).
- `activatePage` cannot see the publish queue in `/bin/replicate.json`; returns success + warning rather than claiming farm publish. Fail-closed when the body *does* show connection/agent errors.
- `suspendWorkflow` / `resumeWorkflow` / `restoreVersion` not exercised on this pass (version name is now available if needed).

---

## Prior run (before fixes)

**When:** 2026-09-14 (local Author)  
**Branch:** `cursor/aem-mcp-modernization-842e`  
**Transport:** `createCatalog` / `runCatalogTool` against `dist/` with `AEM_HOST=http://localhost:4502` and `admin`/`admin` (stdio MCP uses the same). Existing HTTP gateway on `:3001` uses `.env` `mcp-technical` and was used only to prove disabled-tool HTTP status.  
**Throwaway writes:** `/content/mcp-test-20260913` (and a short follow-up page `/content/mcp-test-20260913b`). Both deleted. DAM upload `/content/dam/mcp-test-20260913.png` deleted. We.Retail / Screens / `/content` root were not deleted, activated, or tree-published.

## Counts (47 catalog tools)

| Verdict | Count | Notes |
| --- | ---: | --- |
| pass | 28 | 20 enabled + 8 disabled (`TOOL_DISABLED`) |
| fail | 9 | empty JSON trees or wrong version servlet |
| partial | 5 | success envelope but incomplete payload |
| skip | 5 | workflow start/cancel/suspend/resume; restoreVersion |
| disabled (of the 28 pass) | 8 | rejected, not executed |

Harness-raw (weak empty-array checks) was 35/1/7/5 before recategorizing against the capability matrix.

## listPages `jcr:path`

**Fixed in running dist and stdio MCP.** Sample `limit=5` under `/content/we-retail` returned real paths such as `/content/we-retail/us/en/experience/wester-australia-by-camper-van` with title/template. Remaining issue is `more=false` (QueryBuilder field is `more`, code reads `hasMore`; `p.guessTotal` also reports `total === results`).

## Root cause (most fails)

AEM 6.5 DefaultGetServlet on this Author **ignores** `? :depth=` (encoded or literal). Bounded trees work only with numeric selectors:

| Request | Children |
| --- | --- |
| `/content/we-retail.json` | none (3 keys) |
| `/content/we-retail.json?:depth=2` | none |
| `/content/we-retail.2.json` | `jcr:content`, `us`, `ca`, … |

`src/aem/client.ts` GET passes `{ ':depth': n }` as axios params. That is why `fetchSites`, `listChildren`, `getTemplates`, page text/images/scan, and template structure look “successful” and empty.

## Replication

`/etc/replication/agents.author/publish` **is enabled** (`transportUri=http://localhost:4503/bin/receive?...`). Publish **4503 was down** (`ECONNREFUSED`). Primary suite skipped live replication; a follow-up on throwaway `/content/mcp-test-20260913b` showed `activatePage` / `deactivatePage` / `unpublishContent` returning success envelopes from Author `/bin/replicate.json`, then `deletePage`. Not an end-to-end publish verification.

## Disabled tools

All eight returned MCP `isError` + `code: TOOL_DISABLED` and did not execute. HTTP `POST /api/methods/executeJCRQuery` on `:3001` returned **400** (not 403) with the same code — `gateway.ts` maps every `isError` to 400; `AemError.toJSON()` omits `statusCode`.

## Results

| Tool | Enabled | Sample input (redacted) | Status | Verdict | Expected vs actual | Error | Duration |
| --- | --- | --- | --- | --- | --- | ---: |
| listPages | yes | `{ siteRoot: /content/we-retail, depth: 2, limit: 5 }` | ok | partial | Paths mapped. `more` should be true (QueryBuilder `more: true`, `total: 5`). Actual `more: false`. `depth` is `p.nodedepth`, not descendant depth (documented). | | 19 ms |
| getPageProperties | yes | `{ pagePath: /content/we-retail/us/en }` | ok | pass | Title English, template hero-page. | | 11 ms |
| getPageContent | yes | `{ pagePath: /content/we-retail/us/en, depth: 2 }` | ok | fail | Expected `jcr:content` tree. Actual page node only (`jcr:primaryType`, created). | | 9 ms |
| getAllTextContent | yes | `{ pagePath: /content/we-retail/us/en }` | ok | partial | Expected title/text nodes. Actual `textContent: []` (JSON depth). | | 11 ms |
| getPageTextContent | yes | `{ pagePath: /content/we-retail/us/en }` | ok | partial | Alias of getAllTextContent. Same empty array. | | 12 ms |
| getPageImages | yes | `{ pagePath: /content/we-retail/us/en }` | ok | partial | Expected fileReference/src. Actual `images: []`. | | 9 ms |
| createPage | yes | `{ parentPath: /content, title: MCP Test 20260913, template: /conf/we-retail/settings/wcm/templates/experience-page, name: mcp-test-20260913 }` | ok | pass | Created `/content/mcp-test-20260913`. | | 200 ms |
| deletePage | yes | `{ pagePath: /content/mcp-test-20260913, force: true }` | ok | pass | Deleted throwaway. | | 4303 ms |
| activatePage | yes | `{ pagePath: /content/mcp-test-20260913b }` | ok | pass | Author `/bin/replicate.json` success envelope. Publish 4503 down; not farm-verified. | | 446 ms |
| deactivatePage | yes | `{ pagePath: /content/mcp-test-20260913b }` | ok | pass | Success envelope. | | 184 ms |
| unpublishContent | yes | `{ contentPaths: [/content/mcp-test-20260913b] }` | ok | pass | Per-path deactivate. `unpublishTree` not tested (must 400). | | 162 ms |
| createComponent | yes | `{ pagePath: throwaway, componentType: text, name: mcp_text, properties: { text, textIsRich } }` | ok | pass | `/jcr:content/root/mcp_text`, Core Components text v2. | | 159 ms |
| updateComponent | yes | `{ componentPath: …/mcp_text, properties: { text: updated mcp } }` | ok | pass | `updated: [text]`. | | 239 ms |
| deleteComponent | yes | `{ componentPath: …/mcp_image }` | ok | pass | Deleted image component. | | 100 ms |
| scanPageComponents | yes | `{ pagePath: /content/we-retail/us/en }` | ok | partial | Expected sling:resourceType nodes. Actual `components: []`. | | 14 ms |
| bulkUpdateComponents | yes | `{ updates: [{ componentPath: …/mcp_text, properties: { text: bulk mcp } }], continueOnError: true }` | ok | pass | successful 1 / failed 0. | | 95 ms |
| updateImagePath | yes | `{ componentPath: …/mcp_image, newImagePath: /content/dam/we-retail/en/activities/biking/cycling_1.jpg }` | ok | pass | `fileReference` updated. | | 100 ms |
| uploadAsset | yes | `{ parentPath: /content/dam, fileName: mcp-test-20260913.png, fileContent: [REDACTED 1x1 png], mimeType: image/png }` | ok | pass | `/content/dam/mcp-test-20260913.png`. | | 315 ms |
| updateAsset | yes | `{ assetPath: …png, metadata: { dc:description } }` | ok | pass | Metadata POST. | | 54 ms |
| deleteAsset | yes | `{ assetPath: …png }` | ok | pass | Deleted. | | 49 ms |
| getAssetMetadata | yes | We.Retail JPEG then uploaded png | ok | pass | Metadata objects including `dc:title` after upload. | | 13–14 ms |
| searchContent | yes | `{ path: /content/we-retail, type: cq:Page, fulltext: we-retail, limit: 5 }` | ok | pass | Hits with paths (language-masters, us, es, …). | | 23 ms |
| enhancedPageSearch | yes | `{ searchTerm: experience, basePath: /content/we-retail }` | ok | pass | Experience pages across locales. | | 70 ms |
| fetchSites | yes | `{}` | ok | fail | Expected we-retail under `/content`. Actual `sites: []`. | | 7 ms |
| fetchLanguageMasters | yes | `{ site: we-retail }` | ok | fail | Expected us/ca/…. Actual `[]`. | | 10 ms |
| fetchAvailableLocales | yes | `{ site: we-retail, languageMasterPath: /content/we-retail/us }` | ok | fail | Expected `en`. Actual `[]`. | | 7 ms |
| listChildren | yes | `{ path: /content/we-retail }` | ok | fail | Expected language-masters, us, …. Actual `[]`. | | 12 ms |
| getTemplates | yes | `{ sitePath: /content/we-retail }` | ok | fail | Source path correct (`/conf/we-retail/settings/wcm/templates`). Actual `templates: []`. Direct `.2.json` lists hero-page, content-page, experience-page, …. | | 10 ms |
| getTemplateStructure | yes | `{ templatePath: /conf/we-retail/settings/wcm/templates/experience-page }` | ok | fail | Expected structure/initial/policies. Actual empty objects. | | 9 ms |
| startWorkflow | yes | — | skipped | skip | No model id: `getWorkflowModels` returned `[]` though `/var/workflow/models.json` is a 55-entry `{uri}` array. | | — |
| getStatus | yes | missing instance path | error:RESOURCE_NOT_FOUND | pass | 404 mapped. No live instance (start skipped). | AEM resource not found | 35 ms |
| listActiveWorkflows | yes | `{ limit: 10 }` | ok | pass | `workflows: []` (none RUNNING). | | 26 ms |
| cancelWorkflow | yes | — | skipped | skip | Would not start a workflow without a parsed model. | | — |
| suspendWorkflow | yes | — | skipped | skip | Same. | | — |
| resumeWorkflow | yes | — | skipped | skip | Same. | | — |
| getWorkflowModels | yes | `{}` | ok | fail | Expected `/var` `/conf` `/etc` models. Actual `models: []`. AEM returns a **JSON array** of `{ uri }`; `asRecord()` drops arrays. | | 1236 ms |
| getVersionHistory | yes | We.Retail then throwaway after createVersion | error:SYSTEM_ERROR | fail | Expected versions. Actual 400 `Invalid recursion selector value 'versionhistory'`. Working API: `GET /bin/wcm/versions.json?path=`. | AEM HTTP 400 | 71–91 ms |
| createVersion | yes | `{ path: throwaway, label: mcp-live }` | ok | pass | wcmcommand success envelope. History API broken so version name not verified. | | 300 ms |
| restoreVersion | yes | — | skipped | skip | Blocked: no parseable version name. | | — |
| completeWorkflowStep | no | `{ probe: true }` | error:TOOL_DISABLED | pass | Rejected. | disabled | 0 ms |
| replicateAndPublish | no | `{ probe: true }` | error:TOOL_DISABLED | pass | Rejected. | disabled | 0 ms |
| executeJCRQuery | no | `{ probe: true }` | error:TOOL_DISABLED | pass | Rejected. HTTP convenience: **400** + TOOL_DISABLED (expected 403). | disabled | 0 ms / 47 ms HTTP |
| getNodeContent | no | `{ probe: true }` | error:TOOL_DISABLED | pass | Rejected. | disabled | 0 ms |
| undoChanges | no | `{ probe: true }` | error:TOOL_DISABLED | pass | Rejected. | disabled | 1 ms |
| validateComponent | no | `{ probe: true }` | error:TOOL_DISABLED | pass | Rejected. | disabled | 0 ms |
| deleteVersion | no | `{ probe: true }` | error:TOOL_DISABLED | pass | Rejected. | disabled | 0 ms |
| compareVersions | no | `{ probe: true }` | error:TOOL_DISABLED | pass | Rejected. | disabled | 1 ms |

## Fix plan (do not implement in this pass)

Ranked by severity. File:line against current `src/`.

1. **P0 — Sling JSON depth uses ignored `:depth` query param**  
   - **Where:** `src/aem/client.ts` (~63) and callers (`pages.ts` 148/156/178, `discovery.ts` 12/38/62/83/108/134, `components.ts` scan, `workflow.ts` 42/101, `util.ts` 59).  
   - **Expected:** bounded child nodes (`jcr:content`, sites, templates).  
   - **Actual:** depth-0 node properties only.  
   - **Fix:** GET `{path}.{clampDepth}.json` (numeric selector). Do not rely on `? :depth=`. Add a contract test against a fixture that only `.2.json` includes children.

2. **P0 — `getVersionHistory` wrong selector**  
   - **Where:** `src/aem/workflow.ts` ~136 (`{path}.versionhistory.json`).  
   - **Expected:** version list.  
   - **Actual:** HTTP 400 Invalid recursion selector `versionhistory`.  
   - **Fix:** `GET /bin/wcm/versions.json?path=`. Then restoreVersion can read a real version name.

3. **P1 — `listPages.more` reads the wrong QueryBuilder field**  
   - **Where:** `src/aem/pages.ts` ~116.  
   - **Expected:** `more: true` when `p.limit=5` on We.Retail (`more: true` in raw QB; `total` also equals 5 with `guessTotal`).  
   - **Actual:** `more: false` because code uses `data.hasMore`.  
   - **Fix:** `Boolean(data.more) \|\| Boolean(data.hasMore)`. Do not use `total > hits` alone with `p.guessTotal`.

4. **P1 — `getWorkflowModels` drops JSON arrays**  
   - **Where:** `src/aem/util.ts` 47–50 `asRecord`; `src/aem/workflow.ts` 92–122.  
   - **Expected:** model ids like `/var/workflow/models/activationmodel`.  
   - **Actual:** `[]`. `/var/workflow/models.json` is `[{ uri }, …]` (55 entries).  
   - **Fix:** if Array.isArray, map `uri`; if object map, keep current child walk. Prefer `uri` as `modelId`.

5. **P1 — Disabled tools HTTP 400 instead of 403**  
   - **Where:** `src/http/gateway.ts` ~131; `src/errors.ts` 47–55 `toJSON()` omits `statusCode`.  
   - **Expected:** TOOL_DISABLED / 403.  
   - **Actual:** MCP code is correct; REST always 400.  
   - **Fix:** `res.status(mapped.statusCode \|\| 400)` and include `statusCode` in `toJSON()`.

6. **P2 — `startWorkflow` does not return the instance path**  
   - **Where:** `src/aem/workflow.ts` 16–35.  
   - **Expected:** caller can `getStatus` / cancel the instance just started.  
   - **Actual:** envelope is `{ model, payloadPath, title }` only.  
   - **Fix:** parse Location / response body, or QueryBuilder the new RUNNING instance by payload+title.

7. **P2 — Replication success is not agent-aware**  
   - **Where:** `src/aem/pages.ts` 218–243.  
   - **Expected:** fail or warn if the publish agent is down.  
   - **Actual:** success envelope while 4503 refuses connections.  
   - **Fix:** inspect `/bin/replicate.json` body; optional preflight of agent `jcr:content.enabled` via `.2.json`.

## Residual: AEM quirks vs our bugs

| Observation | Owner |
| --- | --- |
| Numeric `.N.json` selector required; `:depth` ignored | AEM 6.5 GetServlet + our URL shape |
| QueryBuilder field is `more`, and `guessTotal` can set `total === hits` while `more` is true | AEM QB + our `hasMore` |
| `/var/workflow/models.json` is a uri array, not a node map with `jcr:content` | AEM + our `asRecord` |
| `.versionhistory.json` is treated as a recursion selector | AEM + our selector |
| `p.nodedepth` is not descendant page depth | Documented; not a regression |
| `listPages` `jcr:path` mapping | **Our bug, already fixed in dist** |
| Disabled tools execute-quarantine | **Working** (HTTP status only) |
| `mcp-technical` in `.env` vs `admin` in `.cursor/mcp.json` | Ops: HTTP gateway 401s AEM for live tools; stdio is fine |
| Publish agent enabled, 4503 down | Local Author only; replicate.json still 200 |

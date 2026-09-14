# Tool reference

Generated from the typed catalog in `src/mcp/catalog.ts`. Annotations are UX hints, not authorization.

## Enabled

| Name | Risk | readOnly | destructive | idempotent | openWorld |
| --- | --- | --- | --- | --- | --- |
| listPages | read | yes | no | yes | yes |
| getPageProperties | read | yes | no | yes | yes |
| getPageContent | read | yes | no | yes | yes |
| getAllTextContent | read | yes | no | yes | yes |
| getPageTextContent | read | yes | no | yes | yes |
| getPageImages | read | yes | no | yes | yes |
| createPage | write | no | no | no | yes |
| deletePage | destructive | no | yes | no | yes |
| activatePage | write | no | no | no | yes |
| deactivatePage | write | no | no | no | yes |
| unpublishContent | write | no | no | no | yes |
| createComponent | write | no | no | no | yes |
| updateComponent | write | no | no | no | yes |
| deleteComponent | destructive | no | yes | no | yes |
| scanPageComponents | read | yes | no | yes | yes |
| bulkUpdateComponents | write | no | no | no | yes |
| updateImagePath | write | no | no | no | yes |
| uploadAsset | write | no | no | no | yes |
| updateAsset | write | no | no | no | yes |
| deleteAsset | destructive | no | yes | no | yes |
| getAssetMetadata | read | yes | no | yes | yes |
| searchContent | read | yes | no | yes | yes |
| enhancedPageSearch | read | yes | no | yes | yes |
| fetchSites | read | yes | no | yes | yes |
| fetchLanguageMasters | read | yes | no | yes | yes |
| fetchAvailableLocales | read | yes | no | yes | yes |
| listChildren | read | yes | no | yes | yes |
| getTemplates | read | yes | no | yes | yes |
| getTemplateStructure | read | yes | no | yes | yes |
| startWorkflow | write | no | no | no | yes |
| getStatus | read | yes | no | yes | yes |
| listActiveWorkflows | read | yes | no | yes | yes |
| cancelWorkflow | write | no | no | no | yes |
| suspendWorkflow | write | no | no | no | yes |
| resumeWorkflow | write | no | no | no | yes |
| getWorkflowModels | read | yes | no | yes | yes |
| getVersionHistory | read | yes | no | yes | yes |
| createVersion | write | no | no | no | yes |
| restoreVersion | destructive | no | yes | no | yes |

Write and destructive tools accept optional `idempotencyKey` (replay of the same key returns the cached result for 15 minutes in-process). `updateComponent` also accepts `ifMatch` (AEM `cq:lastModified`).

## Disabled (not registered)

completeWorkflowStep, replicateAndPublish, executeJCRQuery, getNodeContent, undoChanges, validateComponent, deleteVersion, compareVersions.

See [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md) for AEM endpoints and rationale.

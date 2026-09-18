import { z, type ZodRawShape } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AemConnector } from '../aem/connector.js';
import { AEM_ERROR_CODES, AemError, isAemError } from '../errors.js';
import { IdempotencyStore } from '../aem/idempotency.js';

export type ToolRisk = 'read' | 'write' | 'destructive';

export interface CatalogTool {
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  risk: ToolRisk;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  inputSchema: ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const path = z.string().min(1);
const optionalLimit = z.number().int().positive().optional();

/**
 * Build the MCP tool catalog for this connector. Disabled tools stay quarantined.
 */
export function createCatalog(aem: AemConnector): CatalogTool[] {
  const tools: CatalogTool[] = [
    readTool(
      'listPages',
      'List pages',
      'List cq:Page nodes under a site root using QueryBuilder with guessTotal.',
      {
        siteRoot: path.optional(),
        depth: z.number().int().min(0).max(5).optional(),
        limit: optionalLimit
      },
      args => aem.pages.listPages(args as { siteRoot?: string; depth?: number; limit?: number })
    ),
    readTool(
      'getPageProperties',
      'Get page properties',
      'Read selected jcr:content properties, including replication status fields.',
      {
        pagePath: path
      },
      args => aem.pages.getPageProperties(String(args.pagePath))
    ),
    readTool(
      'getPageContent',
      'Get page content',
      'Read a page tree with bounded depth. Does not use infinity selectors.',
      {
        pagePath: path,
        depth: z.number().int().min(0).max(5).optional()
      },
      args => aem.pages.getPageContent(String(args.pagePath), args.depth as number | undefined)
    ),
    readTool(
      'getAllTextContent',
      'Extract page text',
      'Extract title/text/description properties from a bounded page tree.',
      {
        pagePath: path
      },
      args => aem.pages.getAllTextContent(String(args.pagePath))
    ),
    readTool(
      'getPageTextContent',
      'Extract page text',
      'Alias of getAllTextContent.',
      {
        pagePath: path
      },
      args => aem.pages.getAllTextContent(String(args.pagePath))
    ),
    readTool(
      'getPageImages',
      'Extract page images',
      'Extract fileReference/src image properties from a bounded page tree.',
      {
        pagePath: path
      },
      args => aem.pages.getPageImages(String(args.pagePath))
    ),
    writeTool(
      'createPage',
      'Create page',
      'Create a page with /bin/wcmcommand createPage so the selected template is applied.',
      {
        parentPath: path,
        title: z.string().min(1),
        template: path,
        name: z.string().optional(),
        properties: z.record(z.unknown()).optional()
      },
      args =>
        aem.pages.createPage(
          args as {
            parentPath: string;
            title: string;
            template: string;
            name?: string;
            properties?: Record<string, unknown>;
          }
        )
    ),
    destructiveTool(
      'deletePage',
      'Delete page',
      'Delete a page with /bin/wcmcommand deletePage.',
      {
        pagePath: path,
        force: z.boolean().optional()
      },
      args => aem.pages.deletePage(args as { pagePath: string; force?: boolean })
    ),
    writeTool(
      'activatePage',
      'Activate page',
      'Replicate a single path with /bin/replicate.json. Tree activation is rejected.',
      {
        pagePath: path,
        activateTree: z.boolean().optional()
      },
      args => aem.pages.activatePage(args as { pagePath: string; activateTree?: boolean })
    ),
    writeTool(
      'deactivatePage',
      'Deactivate page',
      'Deactivate a single path with /bin/replicate.json.',
      {
        pagePath: path,
        deactivateTree: z.boolean().optional()
      },
      args => aem.pages.deactivatePage(args as { pagePath: string; deactivateTree?: boolean })
    ),
    writeTool(
      'unpublishContent',
      'Unpublish content',
      'Deactivate one or more paths individually.',
      {
        contentPaths: z.array(path).min(1),
        unpublishTree: z.boolean().optional()
      },
      async args => {
        if (args.unpublishTree) {
          throw new AemError({
            code: AEM_ERROR_CODES.INVALID_PARAMETERS,
            message: 'unpublishTree is not supported',
            statusCode: 400
          });
        }
        const results = [];
        for (const contentPath of args.contentPaths as string[]) {
          results.push(await aem.pages.deactivatePage({ pagePath: contentPath }));
        }
        return { results };
      }
    ),
    writeTool(
      'createComponent',
      'Create component',
      'Create a component under the page container (default jcr:content/root).',
      {
        pagePath: path,
        componentType: z.string().min(1),
        resourceType: z.string().min(1).optional(),
        name: z.string().optional(),
        parentPath: path.optional(),
        properties: z.record(z.unknown()).optional()
      },
      args =>
        aem.components.createComponent(
          args as {
            pagePath: string;
            componentType: string;
            resourceType?: string;
            name?: string;
            parentPath?: string;
            properties?: Record<string, unknown>;
          }
        )
    ),
    writeTool(
      'updateComponent',
      'Update component',
      'Update writable component properties via Sling POST. Optional ifMatch enforces last-modified concurrency.',
      {
        componentPath: path,
        properties: z.record(z.unknown()),
        ifMatch: z.string().optional()
      },
      args =>
        aem.components.updateComponent(
          args as { componentPath: string; properties: Record<string, unknown>; ifMatch?: string }
        )
    ),
    destructiveTool(
      'deleteComponent',
      'Delete component',
      'Delete a component node via Sling POST :operation=delete.',
      {
        componentPath: path
      },
      args => aem.components.deleteComponent(args as { componentPath: string })
    ),
    readTool(
      'scanPageComponents',
      'Scan components',
      'Discover sling:resourceType nodes under a page with bounded depth.',
      {
        pagePath: path
      },
      args => aem.components.scanPageComponents(String(args.pagePath))
    ),
    writeTool(
      'bulkUpdateComponents',
      'Bulk update components',
      'Update components sequentially. Reports per-item success; does not claim rollback.',
      {
        updates: z
          .array(
            z.object({
              componentPath: path,
              properties: z.record(z.unknown())
            })
          )
          .min(1),
        continueOnError: z.boolean().optional()
      },
      args =>
        aem.components.bulkUpdateComponents(
          args as {
            updates: Array<{ componentPath: string; properties: Record<string, unknown> }>;
            continueOnError?: boolean;
          }
        )
    ),
    writeTool(
      'updateImagePath',
      'Update image path',
      'Set fileReference on an image component.',
      {
        componentPath: path,
        newImagePath: path
      },
      args => aem.components.updateImagePath(String(args.componentPath), String(args.newImagePath))
    ),
    writeTool(
      'uploadAsset',
      'Upload DAM asset',
      'Multipart upload to {parent}.createasset.html. fileContent must be base64.',
      {
        parentPath: path,
        fileName: z.string().min(1),
        fileContent: z.string().min(1),
        mimeType: z.string().optional(),
        metadata: z.record(z.string()).optional()
      },
      args =>
        aem.assets.uploadAsset(
          args as {
            parentPath: string;
            fileName: string;
            fileContent: string;
            mimeType?: string;
            metadata?: Record<string, string>;
          }
        )
    ),
    writeTool(
      'updateAsset',
      'Update asset metadata',
      'Update jcr:content/metadata on an existing asset. Binary replace is not supported.',
      {
        assetPath: path,
        metadata: z.record(z.string())
      },
      args =>
        aem.assets.updateAsset(args as { assetPath: string; metadata?: Record<string, string> })
    ),
    destructiveTool(
      'deleteAsset',
      'Delete asset',
      'Delete a DAM asset via Sling POST.',
      {
        assetPath: path
      },
      args => aem.assets.deleteAsset(args as { assetPath: string })
    ),
    readTool(
      'getAssetMetadata',
      'Get asset metadata',
      'Read jcr:content/metadata for a DAM asset.',
      {
        assetPath: path
      },
      args => aem.assets.getAssetMetadata(String(args.assetPath))
    ),
    readTool(
      'searchContent',
      'Search content',
      'QueryBuilder search with an allowlisted predicate set, path clamp, and p.guessTotal.',
      {
        path: path.optional(),
        type: z.string().optional(),
        fulltext: z.string().optional(),
        limit: optionalLimit
      },
      args =>
        aem.search.searchContent({
          path: args.path,
          type: args.type,
          fulltext: args.fulltext,
          'p.limit': args.limit
        })
    ),
    readTool(
      'enhancedPageSearch',
      'Enhanced page search',
      'Fulltext then title then parent-locale QueryBuilder search.',
      {
        searchTerm: z.string().min(1),
        basePath: path,
        includeAlternateLocales: z.boolean().optional()
      },
      args =>
        aem.search.enhancedPageSearch(
          args as { searchTerm: string; basePath: string; includeAlternateLocales?: boolean }
        )
    ),
    readTool(
      'fetchSites',
      'Fetch sites',
      'List first-level sites under the configured sites root.',
      {},
      () => aem.discovery.fetchSites()
    ),
    readTool(
      'fetchLanguageMasters',
      'Fetch language masters',
      'List children under /content/{site}.',
      {
        site: z.string().min(1)
      },
      args => aem.discovery.fetchLanguageMasters(String(args.site))
    ),
    readTool(
      'fetchAvailableLocales',
      'Fetch locales',
      'List children under a language master path.',
      {
        site: z.string().min(1),
        languageMasterPath: path
      },
      args =>
        aem.discovery.fetchAvailableLocales(String(args.site), String(args.languageMasterPath))
    ),
    readTool(
      'listChildren',
      'List children',
      'List direct child nodes under an allowed path.',
      {
        path
      },
      args => aem.discovery.listChildren(String(args.path))
    ),
    readTool(
      'getTemplates',
      'Get templates',
      'List editable templates under /conf for a site path.',
      {
        sitePath: path.optional()
      },
      args => aem.discovery.getTemplates(args.sitePath as string | undefined)
    ),
    readTool(
      'getTemplateStructure',
      'Get template structure',
      'Read template structure/initial/policies with bounded depth.',
      {
        templatePath: path
      },
      args => aem.discovery.getTemplateStructure(String(args.templatePath))
    ),
    writeTool(
      'startWorkflow',
      'Start workflow',
      'Start a workflow with model, payloadType=JCR_PATH, and payload form fields.',
      {
        model: z.string().min(1),
        payloadPath: path,
        title: z.string().optional(),
        comment: z.string().optional()
      },
      args =>
        aem.workflows.startWorkflow(
          args as { model: string; payloadPath: string; title?: string; comment?: string }
        )
    ),
    readTool(
      'getStatus',
      'Get workflow status',
      'Read a workflow instance JSON document.',
      {
        workflowId: z.string().min(1)
      },
      args => aem.workflows.getWorkflowStatus(String(args.workflowId))
    ),
    readTool(
      'listActiveWorkflows',
      'List active workflows',
      'QueryBuilder listing of RUNNING workflows under /var/workflow/instances.',
      {
        limit: optionalLimit
      },
      args => aem.workflows.listActiveWorkflows(args.limit as number | undefined)
    ),
    writeTool(
      'cancelWorkflow',
      'Cancel workflow',
      'POST state=ABORTED to a workflow instance.',
      {
        workflowId: z.string().min(1),
        reason: z.string().optional()
      },
      args =>
        aem.workflows.cancelWorkflow(String(args.workflowId), args.reason as string | undefined)
    ),
    writeTool(
      'suspendWorkflow',
      'Suspend workflow',
      'POST state=SUSPENDED to a workflow instance.',
      {
        workflowId: z.string().min(1),
        reason: z.string().optional()
      },
      args =>
        aem.workflows.suspendWorkflow(String(args.workflowId), args.reason as string | undefined)
    ),
    writeTool(
      'resumeWorkflow',
      'Resume workflow',
      'POST state=RUNNING to a workflow instance.',
      {
        workflowId: z.string().min(1)
      },
      args => aem.workflows.resumeWorkflow(String(args.workflowId))
    ),
    readTool(
      'getWorkflowModels',
      'Get workflow models',
      'List models from /var, /conf, and /etc workflow model roots.',
      {},
      () => aem.workflows.getWorkflowModels()
    ),
    readTool(
      'getVersionHistory',
      'Get version history',
      'Read /bin/wcm/versions.json for the given path.',
      {
        path
      },
      args => aem.versions.getVersionHistory(String(args.path))
    ),
    writeTool(
      'createVersion',
      'Create version',
      'Create a version via /bin/wcmcommand createVersion.',
      {
        path,
        label: z.string().optional(),
        comment: z.string().optional()
      },
      args =>
        aem.versions.createVersion(
          String(args.path),
          args.label as string | undefined,
          args.comment as string | undefined
        )
    ),
    destructiveTool(
      'restoreVersion',
      'Restore version',
      'Restore a version via /bin/wcmcommand restoreVersion.',
      {
        path,
        versionName: z.string().min(1)
      },
      args => aem.versions.restoreVersion(String(args.path), String(args.versionName))
    )
  ];

  tools.push(
    disabledTool(
      'completeWorkflowStep',
      'Complete workflow step',
      'Disabled: AEM inbox completion requires work item IDs, not step names.'
    ),
    disabledTool(
      'replicateAndPublish',
      'MSM rollout',
      'Disabled: locale/MSM rollout is not a safe OOTB HTTP façade without site topology configuration.'
    ),
    disabledTool(
      'executeJCRQuery',
      'Execute JCR query',
      'Disabled: this was a misleading QueryBuilder wrapper, not JCR-SQL2. Use searchContent.'
    ),
    disabledTool(
      'getNodeContent',
      'Get node content',
      'Disabled: unbounded raw JCR dumps are not returned to LLM clients. Use getPageContent.'
    ),
    disabledTool(
      'undoChanges',
      'Undo changes',
      'Disabled: no verified compensating transaction exists.'
    ),
    disabledTool(
      'validateComponent',
      'Validate component',
      'Disabled: previous implementation only checked locale allowlists, not component dialogs.'
    ),
    disabledTool(
      'deleteVersion',
      'Delete version',
      'Disabled: version deletion is not exposed through a documented wcmcommand in this server.'
    ),
    disabledTool(
      'compareVersions',
      'Compare versions',
      'Disabled: no documented public compare servlet is used.'
    )
  );

  return tools;
}

export async function runCatalogTool(
  tool: CatalogTool,
  args: Record<string, unknown>,
  options: {
    idempotency?: IdempotencyStore;
    logger?: { info: (message: string, metadata?: Record<string, unknown>) => void };
  } = {}
): Promise<CallToolResult> {
  if (!tool.enabled) {
    return errorResult(
      new AemError({
        code: AEM_ERROR_CODES.TOOL_DISABLED,
        message: `${tool.name} is disabled: ${tool.description}`,
        statusCode: 403
      })
    );
  }
  const started = Date.now();
  try {
    const key =
      typeof args.idempotencyKey === 'string' ? `${tool.name}:${args.idempotencyKey}` : undefined;
    const result = options.idempotency
      ? await options.idempotency.remember(key, () => tool.handler(args))
      : await tool.handler(args);
    options.logger?.info('tool.complete', {
      tool: tool.name,
      risk: tool.risk,
      durationMs: Date.now() - started,
      outcome: 'success'
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result as Record<string, unknown>
    };
  } catch (error) {
    options.logger?.info('tool.complete', {
      tool: tool.name,
      risk: tool.risk,
      durationMs: Date.now() - started,
      outcome: 'error'
    });
    return errorResult(error);
  }
}

export function errorResult(error: unknown): CallToolResult {
  const mapped = isAemError(error)
    ? error
    : new AemError({
        code: AEM_ERROR_CODES.SYSTEM_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
  return {
    isError: true,
    content: [{ type: 'text', text: mapped.message }],
    structuredContent: mapped.toJSON()
  };
}

function readTool(
  name: string,
  title: string,
  description: string,
  inputSchema: ZodRawShape,
  handler: CatalogTool['handler']
): CatalogTool {
  return {
    name,
    title,
    description,
    enabled: true,
    risk: 'read',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema,
    handler
  };
}

function writeTool(
  name: string,
  title: string,
  description: string,
  inputSchema: ZodRawShape,
  handler: CatalogTool['handler']
): CatalogTool {
  return {
    name,
    title,
    description,
    enabled: true,
    risk: 'write',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: withIdempotency(inputSchema),
    handler
  };
}

function destructiveTool(
  name: string,
  title: string,
  description: string,
  inputSchema: ZodRawShape,
  handler: CatalogTool['handler']
): CatalogTool {
  return {
    name,
    title,
    description,
    enabled: true,
    risk: 'destructive',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: withIdempotency(inputSchema),
    handler
  };
}

function withIdempotency(inputSchema: ZodRawShape): ZodRawShape {
  return {
    ...inputSchema,
    idempotencyKey: z
      .string()
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional()
  };
}

function disabledTool(name: string, title: string, description: string): CatalogTool {
  return {
    name,
    title,
    description,
    enabled: false,
    risk: 'destructive',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {},
    handler: async () => {
      throw new AemError({
        code: AEM_ERROR_CODES.TOOL_DISABLED,
        message: description,
        statusCode: 403
      });
    }
  };
}

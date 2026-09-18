import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../config.js';
import type { AemConnector } from '../aem/connector.js';
import { createCatalog, runCatalogTool } from './catalog.js';
import { requirePath } from '../aem/util.js';

export function createMcpServer(config: AppConfig, aem: AemConnector): McpServer {
  const server = new McpServer(
    {
      name: 'aem-mcp-server',
      version: '2.0.0'
    },
    {
      instructions: [
        'Standalone AEM 6.5 MCP server. No AEM package is required.',
        'Authenticate to Author with a technical user. Destructive tools mutate the live repository.',
        'Use bounded read tools (listPages, getPageProperties, searchContent) before writes.',
        'Tree activation, MSM rollout, raw JCR dumps, and JCR-SQL2 are intentionally unavailable.'
      ].join(' ')
    }
  );

  const catalog = createCatalog(aem);
  for (const tool of catalog) {
    if (!tool.enabled) {
      continue;
    }
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations
      },
      async args =>
        runCatalogTool(tool, args as Record<string, unknown>, {
          idempotency: aem.idempotency
        })
    );
  }

  server.registerResource(
    'aem-page',
    new ResourceTemplate('aem://page/{+path}', { list: undefined }),
    {
      title: 'AEM page',
      description: 'Bounded JSON for an allowed page path'
    },
    async uri => {
      const rawPath = `/${uri.pathname.replace(/^page\//, '')}`;
      const pagePath = requirePath(decodeURIComponent(rawPath), config);
      const result = await aem.pages.getPageContent(pagePath, 2);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result.data, null, 2)
          }
        ]
      };
    }
  );

  return server;
}

export function listEnabledTools(
  aem: AemConnector
): Array<{ name: string; description: string; risk: string; parameters: string[] }> {
  return createCatalog(aem)
    .filter(tool => tool.enabled)
    .map(tool => ({
      name: tool.name,
      description: tool.description,
      risk: tool.risk,
      parameters: Object.keys(tool.inputSchema)
    }));
}

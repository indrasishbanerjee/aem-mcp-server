import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { AemConnector } from '../aem/connector.js';
import {
  createAuthMiddleware,
  hostOriginGuard,
  requestIdMiddleware
} from '../security/http-auth.js';
import { createMcpServer, listEnabledTools } from '../mcp/create-server.js';
import { createCatalog, runCatalogTool } from '../mcp/catalog.js';
import { AEM_ERROR_CODES, isAemError } from '../errors.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const JSON_BODY_CAP_BYTES = 64 * 1024 * 1024;

function jsonBodyLimitBytes(maxUploadBytes: number): number {
  return Math.min(Math.ceil((maxUploadBytes * 4) / 3) + 1024 * 1024, JSON_BODY_CAP_BYTES);
}

function httpStatusForToolResult(result: CallToolResult): number {
  if (!result.isError) {
    return 200;
  }
  const payload = result.structuredContent;
  if (payload && typeof payload === 'object' && 'statusCode' in payload) {
    const status = Number((payload as { statusCode: unknown }).statusCode);
    if (Number.isInteger(status) && status >= 400 && status < 600) {
      return status;
    }
  }
  return 400;
}

function sdkAllowedHosts(config: AppConfig): string[] {
  const hosts = new Set<string>();
  for (const host of config.http.allowedHosts) {
    hosts.add(host);
    if (!host.includes(':')) {
      hosts.add(`${host}:${config.http.port}`);
    }
  }
  return [...hosts];
}

export function createApp(config: AppConfig, logger: Logger, aem: AemConnector): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(requestIdMiddleware);
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(hostOriginGuard(config));
  app.use(
    cors({
      origin: config.http.corsOrigins.length > 0 ? config.http.corsOrigins : false,
      credentials: false
    })
  );
  const jsonLimit = jsonBodyLimitBytes(config.aem.maxUploadBytes);
  app.use(express.json({ limit: jsonLimit }));
  app.use(express.urlencoded({ extended: false, limit: jsonLimit }));
  app.use(
    rateLimit({
      windowMs: config.http.rateLimitWindowMs,
      limit: config.http.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      skip: req => req.path === '/health/live'
    })
  );
  app.use(createAuthMiddleware(config));

  app.get('/health/ready', async (_req, res) => {
    const connected = await aem.testConnection().catch(() => false);
    res.status(connected ? 200 : 503).json({
      status: connected ? 'ready' : 'not-ready',
      aem: { connected }
    });
  });

  app.get('/health', async (_req, res) => {
    const connected = await aem.testConnection().catch(() => false);
    res.status(connected ? 200 : 503).json({
      status: connected ? 'healthy' : 'degraded',
      aem: { connected },
      mcp: { transport: 'streamable-http', version: '2.0.0' }
    });
  });

  app.post('/mcp', async (req, res) => {
    const server = createMcpServer(config, aem);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      enableDnsRebindingProtection: true,
      allowedHosts: sdkAllowedHosts(config),
      allowedOrigins: config.http.corsOrigins
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get('/api/methods', (_req, res) => {
    const methods = listEnabledTools(aem);
    const categorized: Record<string, typeof methods> = {};
    for (const method of methods) {
      const category = method.risk;
      categorized[category] = categorized[category] ?? [];
      categorized[category].push(method);
    }
    res.json({
      success: true,
      data: {
        methods: categorized,
        totalMethods: methods.length,
        categories: Object.keys(categorized)
      }
    });
  });

  app.post('/api/methods/:methodName', async (req, res) => {
    const catalog = createCatalog(aem);
    const tool = catalog.find(item => item.name === req.params.methodName);
    if (!tool) {
      res.status(404).json({
        success: false,
        error: { code: 'METHOD_NOT_FOUND', message: `Unknown method ${req.params.methodName}` }
      });
      return;
    }
    const result = await runCatalogTool(tool, req.body ?? {}, {
      idempotency: aem.idempotency,
      logger
    });
    const status = httpStatusForToolResult(result);
    res.status(status).json({
      success: !result.isError,
      method: tool.name,
      data: result.structuredContent ?? result.content,
      error: result.isError ? result.structuredContent : undefined
    });
  });

  app.get('/', (_req, res) => {
    res.json({
      name: 'AEM MCP Server',
      version: '2.0.0',
      status: 'pre-production',
      transports: ['stdio', 'streamable-http'],
      endpoints: {
        live: '/health/live',
        ready: '/health/ready',
        mcp: 'POST /mcp',
        methods: 'GET /api/methods'
      }
    });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const mapped = isAemError(error)
      ? error
      : {
          code: AEM_ERROR_CODES.SYSTEM_ERROR,
          message: error instanceof Error ? error.message : 'Internal error',
          statusCode: 500
        };
    logger.error('HTTP error', { error: mapped });
    res.status('statusCode' in mapped ? Number(mapped.statusCode) || 500 : 500).json({
      success: false,
      error: isAemError(error)
        ? error.toJSON()
        : { code: AEM_ERROR_CODES.SYSTEM_ERROR, message: mapped.message }
    });
  });

  return app;
}

export async function startGateway(
  config: AppConfig,
  logger: Logger,
  aem: AemConnector
): Promise<void> {
  const app = createApp(config, logger, aem);
  await new Promise<void>(resolve => {
    const server = app.listen(config.http.port, config.http.host, () => {
      logger.info('AEM MCP HTTP gateway started', {
        host: config.http.host,
        port: config.http.port
      });
      resolve();
    });
    const shutdown = (): void => {
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}

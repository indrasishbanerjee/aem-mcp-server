import { z } from 'zod';
import { AEM_ERROR_CODES, AemError } from './errors.js';

const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);

function csv(value: string | undefined, fallback: string[]): string[] {
  if (!value || !value.trim()) {
    return fallback;
  }
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const configSchema = z.object({
  nodeEnv: z.enum(['development', 'staging', 'production', 'test']),
  aem: z.object({
    host: z.string().url(),
    username: z.string().min(1),
    password: z.string().min(1),
    sitesRoot: z.string(),
    assetsRoot: z.string(),
    templatesRoot: z.string(),
    xfRoot: z.string(),
    defaultAgent: z.string(),
    defaultContainer: z.string(),
    defaultPageResourceType: z.string(),
    allowedComponentTypes: z.array(z.string()).min(1),
    maxLimit: z.number().int().positive(),
    defaultLimit: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    maxDepth: z.number().int().positive(),
    maxUploadBytes: z.number().int().positive(),
    maxConcurrentWrites: z.number().int().positive()
  }),
  http: z.object({
    enabled: z.boolean(),
    host: z.string(),
    port: z.number().int().positive(),
    corsOrigins: z.array(z.string()),
    allowedHosts: z.array(z.string()),
    rateLimitWindowMs: z.number().int().positive(),
    rateLimitMax: z.number().int().positive(),
    username: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional()
  }),
  logging: z.object({
    level: logLevelSchema,
    enableConsole: z.boolean(),
    enableFile: z.boolean(),
    logDirectory: z.string()
  })
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (
    env.NODE_ENV === 'production' || env.NODE_ENV === 'staging' || env.NODE_ENV === 'test'
      ? env.NODE_ENV
      : 'development'
  ) as AppConfig['nodeEnv'];
  const isProd = nodeEnv === 'production' || nodeEnv === 'staging';

  const aemHost = env.AEM_HOST;
  const aemUser = env.AEM_SERVICE_USER;
  const aemPassword = env.AEM_SERVICE_PASSWORD;
  if (!aemHost || !aemUser || !aemPassword) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PARAMETERS,
      message: 'AEM_HOST, AEM_SERVICE_USER, and AEM_SERVICE_PASSWORD are required',
      statusCode: 500
    });
  }
  if (isProd && (aemUser === 'admin' || aemPassword === 'admin')) {
    throw new AemError({
      code: AEM_ERROR_CODES.AUTHENTICATION_FAILED,
      message: 'Default admin/admin AEM credentials are not allowed outside local development',
      statusCode: 500
    });
  }

  const httpEnabled = env.HTTP_ENABLED !== 'false';
  const apiKey = env.MCP_API_KEY;
  const mcpUser = env.MCP_USERNAME;
  const mcpPassword = env.MCP_PASSWORD;
  if (httpEnabled && isProd && !apiKey && !(mcpUser && mcpPassword)) {
    throw new AemError({
      code: AEM_ERROR_CODES.AUTHENTICATION_FAILED,
      message: 'HTTP mode requires MCP_API_KEY or MCP_USERNAME/MCP_PASSWORD',
      statusCode: 500
    });
  }
  if (isProd && (mcpUser === 'admin' || mcpPassword === 'admin')) {
    throw new AemError({
      code: AEM_ERROR_CODES.AUTHENTICATION_FAILED,
      message: 'Default MCP admin/admin credentials are not allowed outside local development',
      statusCode: 500
    });
  }

  const parsed = configSchema.parse({
    nodeEnv,
    aem: {
      host: aemHost,
      username: aemUser,
      password: aemPassword,
      sitesRoot: env.AEM_SITES_ROOT || '/content',
      assetsRoot: env.AEM_ASSETS_ROOT || '/content/dam',
      templatesRoot: env.AEM_TEMPLATES_ROOT || '/conf',
      xfRoot: env.AEM_XF_ROOT || '/content/experience-fragments',
      defaultAgent: env.AEM_DEFAULT_AGENT || 'publish',
      defaultContainer: env.AEM_DEFAULT_CONTAINER || 'root',
      defaultPageResourceType:
        env.AEM_DEFAULT_PAGE_RESOURCE_TYPE || 'core/wcm/components/page/v3/page',
      allowedComponentTypes: csv(env.AEM_ALLOWED_COMPONENTS, [
        'text',
        'image',
        'teaser',
        'button',
        'list',
        'title',
        'separator'
      ]),
      maxLimit: envInt('AEM_QUERY_MAX_LIMIT', 100),
      defaultLimit: envInt('AEM_QUERY_DEFAULT_LIMIT', 20),
      timeoutMs: envInt('AEM_QUERY_TIMEOUT', 30000),
      maxDepth: envInt('AEM_MAX_DEPTH', 5),
      maxUploadBytes: envInt('AEM_MAX_UPLOAD_BYTES', 25 * 1024 * 1024),
      maxConcurrentWrites: envInt('AEM_MAX_CONCURRENT_WRITES', 4)
    },
    http: {
      enabled: httpEnabled,
      host: env.HOST || '127.0.0.1',
      port: envInt('GATEWAY_PORT', 3001),
      corsOrigins: csv(env.CORS_ORIGINS, []),
      allowedHosts: csv(env.ALLOWED_HOSTS, ['127.0.0.1', 'localhost']),
      rateLimitWindowMs: envInt('RATE_LIMIT_WINDOW_MS', 900000),
      rateLimitMax: envInt('RATE_LIMIT_MAX_REQUESTS', 100),
      username: mcpUser,
      password: mcpPassword,
      apiKey
    },
    logging: {
      level: (env.LOG_LEVEL as AppConfig['logging']['level']) || (isProd ? 'warn' : 'info'),
      enableConsole: env.LOG_CONSOLE_ENABLED !== 'false',
      enableFile: env.LOG_FILE_ENABLED === 'true',
      logDirectory: env.LOG_DIRECTORY || './logs'
    }
  });

  return parsed;
}

export function pathPolicy(config: AppConfig): { allowedRoots: string[]; maxDepth: number } {
  return {
    allowedRoots: [
      config.aem.sitesRoot,
      config.aem.assetsRoot,
      config.aem.templatesRoot,
      config.aem.xfRoot
    ],
    maxDepth: config.aem.maxDepth
  };
}

import type { AxiosInstance } from 'axios';
import type { AppConfig } from '../config.js';
import { Logger } from '../logger.js';
import { AemHttpClient } from '../aem/client.js';
import { AemConnector } from '../aem/connector.js';

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    aem: {
      host: 'http://localhost:4502',
      username: 'mcp-technical',
      password: 'secret',
      sitesRoot: '/content',
      assetsRoot: '/content/dam',
      templatesRoot: '/conf',
      xfRoot: '/content/experience-fragments',
      defaultAgent: 'publish',
      defaultContainer: 'root',
      defaultPageResourceType: 'core/wcm/components/page/v3/page',
      allowedComponentTypes: ['text', 'image', 'teaser', 'button'],
      componentResourceTypes: {
        text: 'core/wcm/components/text/v2/text',
        image: 'core/wcm/components/image/v3/image',
        teaser: 'core/wcm/components/teaser/v2/teaser',
        button: 'core/wcm/components/button/v2/button'
      },
      maxLimit: 100,
      defaultLimit: 20,
      timeoutMs: 5000,
      maxDepth: 5,
      maxUploadBytes: 1024 * 1024,
      maxConcurrentWrites: 2,
      ...(overrides.aem ?? {})
    },
    http: {
      enabled: true,
      host: '127.0.0.1',
      port: 3001,
      corsOrigins: [],
      allowedHosts: ['127.0.0.1', 'localhost'],
      rateLimitWindowMs: 60000,
      rateLimitMax: 1000,
      apiKey: 'test-api-key',
      ...(overrides.http ?? {})
    },
    logging: {
      level: 'error',
      enableConsole: false,
      enableFile: false,
      logDirectory: './logs',
      ...(overrides.logging ?? {})
    },
    ...overrides
  };
}

export function silentLogger(): Logger {
  return new Logger({
    level: 'error',
    enableConsole: false,
    enableFile: false,
    logDirectory: './logs'
  });
}

interface FakeCall {
  method: string;
  path: string;
  data?: unknown;
  headers?: Record<string, string>;
  params?: unknown;
}

export class FakeAuthor {
  readonly calls: FakeCall[] = [];
  csrfToken = 'csrf-test-token';
  resources = new Map<string, unknown>();
  queryBuilderResponse: Record<string, unknown> = {
    hits: [
      {
        'jcr:path': '/content/mysite/en',
        'jcr:primaryType': 'cq:Page',
        'jcr:content': {
          'jcr:title': 'Home',
          'cq:template': '/conf/mysite/settings/wcm/templates/page',
          'sling:resourceType': 'core/wcm/components/page/v3/page'
        }
      }
    ],
    total: 1,
    more: false
  };
  private postErrors: Array<{ status: number; data: unknown; headers?: Record<string, string> }> =
    [];
  private postSuccesses: Array<{ data: unknown; headers?: Record<string, string>; status?: number }> =
    [];

  failNextPost(status: number, data: unknown, headers?: Record<string, string>): void {
    this.postErrors.push({ status, data, headers });
  }

  succeedNextPost(data: unknown, headers?: Record<string, string>, status = 200): void {
    this.postSuccesses.push({ data, headers, status });
  }

  constructor() {
    this.resources.set('/conf/mysite/settings/wcm/templates/page', {
      'jcr:primaryType': 'cq:Template'
    });
    this.resources.set('/content/mysite/en/jcr:content', {
      'jcr:title': 'Home',
      'cq:template': '/conf/mysite/settings/wcm/templates/page',
      'sling:resourceType': 'core/wcm/components/page/v3/page',
      'cq:lastModified': '2024-01-01T00:00:00.000Z'
    });
    this.resources.set('/content/mysite/en', {
      'jcr:primaryType': 'cq:Page',
      'jcr:content': {
        'jcr:title': 'Home',
        text: 'Hello',
        fileReference: '/content/dam/logo.png'
      }
    });
    this.resources.set('/content/mysite/en/jcr:content/root/text', {
      'sling:resourceType': 'core/wcm/components/text/v2/text',
      'cq:lastModified': '2024-01-01T00:00:00.000Z',
      text: 'Hello'
    });
  }

  asAxios(): AxiosInstance {
    const self = this;
    return {
      get: async (path: string, config?: { params?: Record<string, unknown> }) => {
        self.calls.push({ method: 'GET', path, params: config?.params });
        if (path.includes('/libs/granite/csrf/token.json')) {
          return { data: { token: self.csrfToken } };
        }
        if (path.includes('/bin/querybuilder.json')) {
          return { data: self.queryBuilderResponse };
        }
        if (path.includes('/bin/wcm/versions.json')) {
          return {
            data: {
              versions: [{ versionName: '1.0', label: 'mcp-live', created: '2026-01-01T00:00:00.000Z' }]
            }
          };
        }
        const numeric = /^(.*)\.(\d+)\.json$/.exec(path);
        const key = numeric
          ? numeric[1]
          : path.replace(/\.versionhistory\.json$/, '').replace(/\.json$/, '');
        const stored = self.resources.get(key);
        if (stored === undefined) {
          const error = Object.assign(new Error('not found'), {
            isAxiosError: true,
            response: { status: 404 },
            config: {}
          });
          throw error;
        }
        const depth = numeric ? Number(numeric[2]) : path.endsWith('.json') ? 0 : undefined;
        return { data: depth === undefined ? stored : jsonAtDepth(stored, depth) };
      },
      post: async (path: string, body: unknown, config?: { headers?: Record<string, string> }) => {
        self.calls.push({
          method: 'POST',
          path,
          data: body,
          headers: config?.headers
        });
        const queued = self.postErrors.shift();
        if (queued) {
          throw Object.assign(new Error('AEM POST failed'), {
            isAxiosError: true,
            response: {
              status: queued.status,
              data: queued.data,
              headers: queued.headers ?? {}
            },
            config: {}
          });
        }
        const success = self.postSuccesses.shift();
        if (success) {
          return {
            data: success.data,
            headers: success.headers ?? {},
            status: success.status ?? 200
          };
        }
        if (path.includes('/workflow/instances')) {
          const location = '/var/workflow/instances/server0/2026-01-01/request_for_activation_1';
          return { data: { path: location }, headers: { location }, status: 201 };
        }
        return { data: { success: true }, headers: {}, status: 200 };
      }
    } as unknown as AxiosInstance;
  }
}

function jsonAtDepth(value: unknown, depth: number): unknown {
  if (Array.isArray(value) || value === null || typeof value !== 'object') {
    return value;
  }
  const record = value as Record<string, unknown>;
  if (depth <= 0) {
    const shallow: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        continue;
      }
      shallow[key] = child;
    }
    return shallow;
  }
  const nested: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    nested[key] =
      child && typeof child === 'object' && !Array.isArray(child)
        ? jsonAtDepth(child, depth - 1)
        : child;
  }
  return nested;
}

export function makeConnector(author = new FakeAuthor()): {
  connector: AemConnector;
  author: FakeAuthor;
} {
  const config = makeConfig();
  const client = new AemHttpClient(config, silentLogger(), author.asAxios());
  return { connector: new AemConnector(config, silentLogger(), client), author };
}

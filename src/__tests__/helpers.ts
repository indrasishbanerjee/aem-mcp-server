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
  resources = new Map<string, Record<string, unknown>>();

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
          return {
            data: {
              hits: [{ path: '/content/mysite/en', 'jcr:content/jcr:title': 'Home' }],
              total: 1,
              hasMore: false
            }
          };
        }
        const key = path
          .replace(/\.json$/, '')
          .replace(/\/jcr:content\/metadata$/, '/jcr:content/metadata');
        const stripped = path.replace(/\.versionhistory\.json$/, '').replace(/\.json$/, '');
        const data = self.resources.get(stripped) ?? self.resources.get(key);
        if (!data) {
          const error = Object.assign(new Error('not found'), {
            isAxiosError: true,
            response: { status: 404 },
            config: {}
          });
          throw error;
        }
        return { data };
      },
      post: async (path: string, body: unknown, config?: { headers?: Record<string, string> }) => {
        self.calls.push({
          method: 'POST',
          path,
          data: body,
          headers: config?.headers
        });
        return { data: { success: true } };
      }
    } as unknown as AxiosInstance;
  }
}

export function makeConnector(author = new FakeAuthor()): {
  connector: AemConnector;
  author: FakeAuthor;
} {
  const config = makeConfig();
  const client = new AemHttpClient(config, silentLogger(), author.asAxios());
  return { connector: new AemConnector(config, silentLogger(), client), author };
}

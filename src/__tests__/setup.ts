/**
 * Test Setup Configuration
 * Configures Jest for unit testing with mocks and utilities
 */

import { jest } from '@jest/globals';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  default: {
    create: jest.fn()
  }
}));

// Mock logger
export const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  methodStart: jest.fn(),
  methodEnd: jest.fn(),
  methodError: jest.fn(),
  httpRequest: jest.fn(),
  aemOperation: jest.fn(),
  performance: jest.fn(),
  security: jest.fn(),
  health: jest.fn()
};

// Mock configuration
export const mockConfig = {
  aem: {
    host: 'http://localhost:4502',
    author: 'http://localhost:4502',
    publish: 'http://localhost:4503',
    serviceUser: {
      username: 'admin',
      password: 'admin'
    },
    endpoints: {
      content: '/content',
      dam: '/content/dam',
      query: '/bin/querybuilder.json',
      crxde: '/crx/de',
      jcr: '',
      replicate: '/bin/replicate.json',
      wcmcommand: '/bin/wcmcommand'
    },
    contentPaths: {
      sitesRoot: '/content',
      assetsRoot: '/content/dam',
      templatesRoot: '/conf',
      experienceFragmentsRoot: '/content/experience-fragments'
    },
    replication: {
      publisherUrls: ['http://localhost:4503'],
      defaultReplicationAgent: 'publish'
    },
    components: {
      allowedTypes: ['text', 'image', 'hero', 'button', 'list', 'teaser', 'carousel'],
      defaultProperties: {
        'jcr:primaryType': 'nt:unstructured',
        'sling:resourceType': 'foundation/components/text'
      }
    },
    queries: {
      maxLimit: 100,
      defaultLimit: 20,
      timeoutMs: 30000
    },
    validation: {
      maxDepth: 5,
      allowedLocales: ['en']
    }
  },
  mcp: {
    name: 'AEM MCP Server',
    version: '1.0.0',
    port: 8080,
    gatewayPort: 3001
  },
  server: {
    port: 3001,
    host: 'localhost',
    cors: {
      enabled: true,
      origins: ['*']
    },
    rateLimit: {
      enabled: true,
      windowMs: 900000,
      maxRequests: 100
    }
  },
  security: {
    auth: {
      enabled: true,
      type: 'basic' as const
    },
    cors: {
      enabled: true,
      origins: ['*'],
      credentials: false
    },
    headers: {
      enabled: true,
      hsts: true,
      noSniff: true,
      xssProtection: true
    }
  },
  logging: {
    level: 'info' as const,
    enableConsole: true,
    enableFile: false,
    logDirectory: './logs',
    maxFileSize: 10485760,
    maxFiles: 5,
    enableStructuredLogging: false,
    enableCorrelation: false
  }
};

// Mock HTTP client
export const mockHttpClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  }
};

// Test utilities
export const createMockResponse = (data: any, status = 200) => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
  config: {}
});

export const createMockError = (message: string, status = 500) => {
  const error = new Error(message) as any;
  error.response = {
    status,
    statusText: 'Internal Server Error',
    data: { message },
    headers: {},
    config: {}
  };
  return error;
};

// Mock AEM responses
export const mockAEMResponses = {
  pageContent: {
    'jcr:content': {
      'jcr:title': 'Test Page',
      'jcr:description': 'Test Description',
      'cq:template': '/conf/test/settings/wcm/templates/test-template',
      'sling:resourceType': 'foundation/components/page',
      'cq:lastModified': '2024-01-01T00:00:00.000Z',
      'cq:lastModifiedBy': 'admin'
    }
  },
  pageList: {
    hits: [
      {
        path: '/content/test/page1',
        'jcr:content/jcr:title': 'Page 1',
        'jcr:content/cq:template': '/conf/test/settings/wcm/templates/page-template',
        'jcr:content/cq:lastModified': '2024-01-01T00:00:00.000Z'
      },
      {
        path: '/content/test/page2',
        'jcr:content/jcr:title': 'Page 2',
        'jcr:content/cq:template': '/conf/test/settings/wcm/templates/page-template',
        'jcr:content/cq:lastModified': '2024-01-02T00:00:00.000Z'
      }
    ],
    total: 2
  },
  templates: {
    'template1': {
      'jcr:content': {
        'jcr:title': 'Template 1',
        'jcr:description': 'Test Template 1',
        'status': 'enabled',
        'ranking': 10
      }
    },
    'template2': {
      'jcr:content': {
        'jcr:title': 'Template 2',
        'jcr:description': 'Test Template 2',
        'status': 'enabled',
        'ranking': 5
      }
    }
  },
  componentContent: {
    'jcr:primaryType': 'nt:unstructured',
    'sling:resourceType': 'foundation/components/text',
    'text': 'Test text content'
  },
  assetMetadata: {
    'jcr:content': {
      'metadata': {
        'dc:title': 'Test Asset',
        'dc:description': 'Test asset description',
        'dc:creator': 'admin'
      }
    }
  }
};

// Setup global test configuration
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.resetAllMocks();
});

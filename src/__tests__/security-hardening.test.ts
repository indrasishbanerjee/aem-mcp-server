import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { AEM_ERROR_CODES } from '../errors.js';
import { createApp } from '../http/gateway.js';
import { loadConfig } from '../config.js';
import { IdempotencyStore } from '../aem/idempotency.js';
import { FakeAuthor, makeConfig, makeConnector, silentLogger } from './helpers.js';

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    AEM_HOST: 'http://localhost:4502',
    AEM_SERVICE_USER: 'mcp-technical',
    AEM_SERVICE_PASSWORD: 'secret',
    HTTP_ENABLED: 'false',
    ...overrides
  };
}

describe('Sling POST allowlist and createPage reserved keys', () => {
  it('rejects Sling operation and @ suffix keys', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.components.updateComponent({
        componentPath: '/content/mysite/en/jcr:content/root/text',
        properties: { ':operation': 'delete' }
      })
    ).rejects.toThrow(/not an allowed Sling field/i);
    await expect(
      connector.components.updateComponent({
        componentPath: '/content/mysite/en/jcr:content/root/text',
        properties: { 'jcr:title@CopyFrom': '/content/other' }
      })
    ).rejects.toThrow(/not an allowed Sling field/i);
  });

  it('does not let extras overwrite wcmcommand cmd', async () => {
    const { connector, author } = makeConnector();
    await connector.pages.createPage({
      parentPath: '/content/mysite/en',
      title: 'About Us',
      template: '/conf/mysite/settings/wcm/templates/page',
      properties: { cmd: 'deletePage', title: 'Hijacked' }
    });
    const post = author.calls.find(
      call => call.method === 'POST' && call.path === '/bin/wcmcommand'
    );
    const body = String(post?.data);
    expect(body).toContain('cmd=createPage');
    expect(body).not.toContain('cmd=deletePage');
    expect(body).toContain('title=About+Us');
    expect(body).not.toContain('title=Hijacked');
  });
});

describe('component resourceType map and parentPath', () => {
  it('rejects a resourceType that disagrees with the allowlist map', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.components.createComponent({
        pagePath: '/content/mysite/en',
        componentType: 'text',
        resourceType: 'foundation/components/text',
        name: 'evil'
      })
    ).rejects.toMatchObject({ code: AEM_ERROR_CODES.INVALID_PARAMETERS });
  });

  it('rejects parentPath outside the page jcr:content tree', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.components.createComponent({
        pagePath: '/content/mysite/en',
        componentType: 'text',
        resourceType: 'core/wcm/components/text/v2/text',
        parentPath: '/content/othersite/jcr:content/root',
        name: 'text1'
      })
    ).rejects.toThrow(/jcr:content/);
  });
});

describe('ifMatch fail-closed', () => {
  it('returns 409 when ifMatch is supplied and lastModified is empty', async () => {
    const author = new FakeAuthor();
    author.resources.set('/content/mysite/en/jcr:content/root/nestamp', {
      'sling:resourceType': 'core/wcm/components/text/v2/text',
      text: 'no stamp'
    });
    const { connector } = makeConnector(author);
    await expect(
      connector.components.updateComponent({
        componentPath: '/content/mysite/en/jcr:content/root/nestamp',
        properties: { text: 'x' },
        ifMatch: 'anything'
      })
    ).rejects.toMatchObject({ code: AEM_ERROR_CODES.CONFLICT, statusCode: 409 });
  });
});

describe('workflow path encoding', () => {
  it('rejects encoded traversal in workflow instance ids', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.workflows.getWorkflowStatus('/var/workflow/instances/%2e%2e/content')
    ).rejects.toMatchObject({ code: AEM_ERROR_CODES.INVALID_PATH });
    await expect(
      connector.workflows.cancelWorkflow('/var/workflow/instances/%2e%2e%2fcontent')
    ).rejects.toMatchObject({ code: AEM_ERROR_CODES.INVALID_PATH });
  });

  it('rejects workflow models outside known model roots', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.workflows.startWorkflow({
        model: '/content/mysite/en',
        payloadPath: '/content/mysite/en'
      })
    ).rejects.toMatchObject({ code: AEM_ERROR_CODES.INVALID_PATH });
  });
});

describe('asset metadata and MIME allowlists', () => {
  it('rejects unsafe metadata keys', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.assets.updateAsset({
        assetPath: '/content/dam/mysite/logo.png',
        metadata: { ':operation': 'delete' }
      })
    ).rejects.toThrow(/not an allowed Sling field/i);
  });

  it('rejects unknown MIME types instead of defaulting to octet-stream', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.assets.uploadAsset({
        parentPath: '/content/dam/mysite',
        fileName: 'payload.exe',
        fileContent: Buffer.from('hi').toString('base64'),
        mimeType: 'application/x-msdownload'
      })
    ).rejects.toMatchObject({ code: AEM_ERROR_CODES.INVALID_PARAMETERS });
    await expect(
      connector.assets.uploadAsset({
        parentPath: '/content/dam/mysite',
        fileName: 'payload.bin',
        fileContent: Buffer.from('hi').toString('base64')
      })
    ).rejects.toThrow(/MIME/i);
  });
});

describe('CSRF vs ACL 403', () => {
  it('retries Granite CSRF 403 once then succeeds', async () => {
    const author = new FakeAuthor();
    author.failNextPost(403, 'invalid csrf token');
    const { connector, author: used } = makeConnector(author);
    await connector.pages.deletePage({ pagePath: '/content/mysite/en' });
    const posts = used.calls.filter(call => call.method === 'POST');
    expect(posts.length).toBe(2);
  });

  it('does not retry ACL 403 and maps to insufficient permissions', async () => {
    const author = new FakeAuthor();
    author.failNextPost(403, '<html>Forbidden</html>');
    const { connector, author: used } = makeConnector(author);
    await expect(
      connector.pages.deletePage({ pagePath: '/content/mysite/en' })
    ).rejects.toMatchObject({ code: AEM_ERROR_CODES.INSUFFICIENT_PERMISSIONS });
    const posts = used.calls.filter(call => call.method === 'POST');
    expect(posts.length).toBe(1);
  });

  it('fails closed as CSRF_FAILED when the CSRF retry also 403s', async () => {
    const author = new FakeAuthor();
    author.failNextPost(403, { message: 'Invalid CSRF Token' });
    author.failNextPost(403, { message: 'Invalid CSRF Token' });
    const { connector } = makeConnector(author);
    await expect(
      connector.pages.deletePage({ pagePath: '/content/mysite/en' })
    ).rejects.toMatchObject({ code: AEM_ERROR_CODES.CSRF_FAILED });
  });
});

describe('circuit breaker client errors', () => {
  it('does not open the breaker on repeated 404s', async () => {
    const { connector } = makeConnector();
    for (let i = 0; i < 6; i += 1) {
      await expect(
        connector.pages.getPageProperties('/content/missing-page')
      ).rejects.toMatchObject({ code: AEM_ERROR_CODES.RESOURCE_NOT_FOUND });
    }
    await expect(
      connector.pages.activatePage({ pagePath: '/content/mysite/en' })
    ).resolves.toMatchObject({ success: true });
  });
});

describe('idempotency singleflight', () => {
  it('waits on an in-flight remember for the same key', async () => {
    const store = new IdempotencyStore(60_000);
    let runs = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const first = store.remember('createPage:same', async () => {
      runs += 1;
      await gate;
      return { ok: true };
    });
    const second = store.remember('createPage:same', async () => {
      runs += 1;
      return { ok: false };
    });
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(runs).toBe(1);
  });
});

describe('HTTP auth in every environment', () => {
  it('requires MCP credentials when HTTP is enabled in development', () => {
    expect(() =>
      loadConfig(
        baseEnv({
          NODE_ENV: 'development',
          HTTP_ENABLED: 'true'
        })
      )
    ).toThrow(expect.objectContaining({ code: AEM_ERROR_CODES.AUTHENTICATION_FAILED }));
  });

  it('rejects unauthenticated method access even when nodeEnv is development', async () => {
    const { connector } = makeConnector();
    const app = createApp(
      makeConfig({
        nodeEnv: 'development',
        http: {
          enabled: true,
          host: '127.0.0.1',
          port: 3001,
          corsOrigins: [],
          allowedHosts: ['127.0.0.1', 'localhost'],
          rateLimitWindowMs: 60000,
          rateLimitMax: 1000
        }
      }),
      silentLogger(),
      connector
    );
    await request(app).get('/health/live').expect(200);
    await request(app).get('/api/methods').expect(401);
  });
});

describe('liveness probe exemptions', () => {
  it('allows unauthenticated /health/live even with a foreign Host header', async () => {
    const { connector } = makeConnector();
    const app = createApp(makeConfig(), silentLogger(), connector);
    await request(app).get('/health/live').set('Host', 'evil.example').expect(200);
    await request(app)
      .get('/api/methods')
      .set('Host', 'evil.example')
      .set('x-api-key', 'test-api-key')
      .expect(403);
  });

  it('does not serve the dashboard tool runner', async () => {
    const { connector } = makeConnector();
    const app = createApp(makeConfig(), silentLogger(), connector);
    await request(app).get('/dashboard').set('x-api-key', 'test-api-key').expect(404);
  });

  it('accepts Streamable HTTP initialize with Host including the gateway port', async () => {
    const { connector } = makeConnector();
    const app = createApp(makeConfig(), silentLogger(), connector);
    const response = await request(app)
      .post('/mcp')
      .set('Host', '127.0.0.1:3001')
      .set('x-api-key', 'test-api-key')
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'ops', version: '0' }
        }
      });
    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
    expect(response.body.result.protocolVersion).toBeDefined();
  });
});

describe('HTTP disabled tools', () => {
  it('returns 403 TOOL_DISABLED for quarantined methods', async () => {
    const { connector } = makeConnector();
    const app = createApp(makeConfig(), silentLogger(), connector);
    const response = await request(app)
      .post('/api/methods/executeJCRQuery')
      .set('x-api-key', 'test-api-key')
      .send({ probe: true });
    expect(response.status).toBe(403);
    expect(response.body.error?.code ?? response.body.data?.code).toBe(AEM_ERROR_CODES.TOOL_DISABLED);
    expect(response.body.error?.statusCode ?? response.body.data?.statusCode).toBe(403);
  });
});

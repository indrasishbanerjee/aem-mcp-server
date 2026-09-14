import { describe, expect, it } from '@jest/globals';
import { makeConnector, FakeAuthor } from './helpers.js';
import { createCatalog } from '../mcp/catalog.js';

describe('AEM HTTP contracts', () => {
  it('creates pages via /bin/wcmcommand createPage', async () => {
    const { connector, author } = makeConnector();
    await connector.pages.createPage({
      parentPath: '/content/mysite/en',
      title: 'About Us',
      template: '/conf/mysite/settings/wcm/templates/page'
    });
    const post = author.calls.find(
      call => call.method === 'POST' && call.path === '/bin/wcmcommand'
    );
    expect(post).toBeDefined();
    const body = String(post?.data);
    expect(body).toContain('cmd=createPage');
    expect(body).toContain('template=%2Fconf%2Fmysite');
    expect(post?.headers?.['CSRF-Token']).toBe('csrf-test-token');
  });

  it('maps QueryBuilder jcr:path and nested jcr:content in listPages', async () => {
    const { connector } = makeConnector();
    const result = await connector.pages.listPages({ siteRoot: '/content/mysite' });
    expect(result.data.pages[0]).toMatchObject({
      path: '/content/mysite/en',
      name: 'en',
      title: 'Home'
    });
  });

  it('rejects tree activation', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.pages.activatePage({
        pagePath: '/content/mysite/en',
        activateTree: true
      })
    ).rejects.toThrow(/Tree activate/);
  });

  it('replicates a single path via /bin/replicate.json', async () => {
    const { connector, author } = makeConnector();
    await connector.pages.activatePage({ pagePath: '/content/mysite/en' });
    const post = author.calls.find(call => call.path === '/bin/replicate.json');
    expect(String(post?.data)).toContain('cmd=Activate');
    expect(String(post?.data)).not.toContain('deep=true');
  });

  it('uploads assets to createasset.html as multipart', async () => {
    const { connector, author } = makeConnector();
    await connector.assets.uploadAsset({
      parentPath: '/content/dam/mysite',
      fileName: 'logo.png',
      fileContent: Buffer.from('hi').toString('base64'),
      mimeType: 'image/png'
    });
    const post = author.calls.find(call => String(call.path).includes('createasset.html'));
    expect(post).toBeDefined();
    expect(post?.data).toBeInstanceOf(FormData);
  });

  it('starts workflows with form model/payloadType/payload', async () => {
    const { connector, author } = makeConnector();
    author.resources.set('/content/mysite/en', { 'jcr:primaryType': 'cq:Page' });
    await connector.workflows.startWorkflow({
      model: '/var/workflow/models/request_for_activation',
      payloadPath: '/content/mysite/en'
    });
    const post = author.calls.find(call => call.path === '/etc/workflow/instances');
    const body = String(post?.data);
    expect(body).toContain('payloadType=JCR_PATH');
    expect(body).toContain('payload=%2Fcontent%2Fmysite%2Fen');
  });

  it('allowlists QueryBuilder predicates', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.search.searchContent({
        path: '/content/mysite',
        group: '1'
      })
    ).rejects.toThrow(/not allowed/);
  });

  it('creates components with primary type and resource type', async () => {
    const { connector, author } = makeConnector();
    await connector.components.createComponent({
      pagePath: '/content/mysite/en',
      componentType: 'text',
      resourceType: 'core/wcm/components/text/v2/text',
      name: 'text1'
    });
    const post = author.calls.find(call => String(call.path).includes('/root/text1'));
    const body = String(post?.data);
    expect(body).toContain('jcr%3AprimaryType=nt%3Aunstructured');
    expect(body).toContain('sling%3AresourceType=core');
  });

  it('enforces last-modified ifMatch on component update', async () => {
    const { connector } = makeConnector();
    await expect(
      connector.components.updateComponent({
        componentPath: '/content/mysite/en/jcr:content/root/text',
        properties: { text: 'x' },
        ifMatch: 'stale'
      })
    ).rejects.toThrow(/ifMatch/);
  });
});

describe('catalog quarantine', () => {
  it('does not enable unverified tools', () => {
    const { connector } = makeConnector();
    const catalog = createCatalog(connector);
    const disabled = catalog.filter(tool => !tool.enabled).map(tool => tool.name);
    expect(disabled).toEqual(
      expect.arrayContaining([
        'completeWorkflowStep',
        'replicateAndPublish',
        'executeJCRQuery',
        'getNodeContent',
        'undoChanges'
      ])
    );
    expect(
      catalog
        .filter(tool => tool.enabled)
        .every(tool => tool.annotations.readOnlyHint !== undefined)
    ).toBe(true);
  });
});

describe('Sling JSON numeric selectors', () => {
  it('loads page trees via path.n.json and not ignored :depth query params', async () => {
    const { connector, author } = makeConnector();
    const result = await connector.pages.getPageContent('/content/mysite/en', 2);
    const get = author.calls.find(
      call => call.method === 'GET' && String(call.path).startsWith('/content/mysite/en')
    );
    expect(get?.path).toBe('/content/mysite/en.2.json');
    expect(get?.params).toBeUndefined();
    expect(result.data.content['jcr:content']).toMatchObject({ 'jcr:title': 'Home' });
  });

  it('does not expose child nodes on bare .json (AEM 6.5 GetServlet)', async () => {
    const { connector, author } = makeConnector();
    await connector.pages.getPageContent('/content/mysite/en', 0);
    const get = author.calls.find(
      call => call.method === 'GET' && String(call.path).startsWith('/content/mysite/en')
    );
    expect(get?.path).toBe('/content/mysite/en.0.json');
    const shallow = await connector.discovery.listChildren('/content/mysite/en');
    const listGet = author.calls.filter(call => call.method === 'GET').pop();
    expect(listGet?.path).toBe('/content/mysite/en.1.json');
    expect(shallow.data.children.length).toBeGreaterThanOrEqual(0);
  });

  it('lists sites from /content.2.json children', async () => {
    const author = new FakeAuthor();
    author.resources.set('/content', {
      'jcr:primaryType': 'sling:Folder',
      'we-retail': {
        'jcr:primaryType': 'cq:Page',
        'jcr:content': { 'jcr:title': 'We.Retail' }
      }
    });
    const { connector } = makeConnector(author);
    const result = await connector.discovery.fetchSites();
    const get = author.calls.find(call => call.method === 'GET' && String(call.path).includes('/content'));
    expect(get?.path).toBe('/content.2.json');
    expect(result.data.sites.some(site => site.name === 'we-retail')).toBe(true);
  });
});

describe('version history servlet', () => {
  it('reads /bin/wcm/versions.json?path= instead of .versionhistory.json', async () => {
    const { connector, author } = makeConnector();
    const result = await connector.versions.getVersionHistory('/content/mysite/en');
    const get = author.calls.find(call => String(call.path).includes('version'));
    expect(get?.path).toBe('/bin/wcm/versions.json');
    expect(get?.params).toMatchObject({ path: '/content/mysite/en' });
    expect(author.calls.some(call => String(call.path).includes('versionhistory'))).toBe(false);
    expect(result.data.versions).toBeDefined();
  });
});

describe('QueryBuilder more flag', () => {
  it('uses QueryBuilder more even when guessTotal total equals hit count', async () => {
    const author = new FakeAuthor();
    author.queryBuilderResponse = {
      ...author.queryBuilderResponse,
      total: 1,
      more: true,
      hasMore: false
    };
    const { connector } = makeConnector(author);
    const result = await connector.pages.listPages({ siteRoot: '/content/mysite', limit: 1 });
    expect(result.data.pages).toHaveLength(1);
    expect(result.data.more).toBe(true);
  });

  it('does not treat hasMore as the QueryBuilder pagination field', async () => {
    const author = new FakeAuthor();
    author.queryBuilderResponse = {
      ...author.queryBuilderResponse,
      total: 1,
      more: false,
      hasMore: true
    };
    const { connector } = makeConnector(author);
    const result = await connector.pages.listPages({ siteRoot: '/content/mysite', limit: 1 });
    expect(result.data.more).toBe(false);
  });
});

describe('workflow models JSON arrays', () => {
  it('parses a top-level {uri} array from /var/workflow/models.json', async () => {
    const author = new FakeAuthor();
    author.resources.set('/var/workflow/models', [
      { uri: '/var/workflow/models/request_for_activation' },
      { uri: '/var/workflow/models/dam-set-last-modified', title: 'DAM Set Last Modified' }
    ]);
    const { connector } = makeConnector(author);
    const result = await connector.workflows.getWorkflowModels();
    expect(result.data.models.length).toBeGreaterThanOrEqual(2);
    expect(result.data.models.map(model => model.modelId)).toEqual(
      expect.arrayContaining([
        '/var/workflow/models/request_for_activation',
        '/var/workflow/models/dam-set-last-modified'
      ])
    );
  });

  it('parses Sling {uri}[] keys when the payload is an object', async () => {
    const author = new FakeAuthor();
    author.resources.set('/var/workflow/models', {
      'jcr:primaryType': 'sling:Folder',
      '{uri}[]': [
        '/var/workflow/models/activationmodel',
        { uri: '/var/workflow/models/publish_example' }
      ]
    });
    const { connector } = makeConnector(author);
    const result = await connector.workflows.getWorkflowModels();
    expect(result.data.models.map(model => model.modelId)).toEqual(
      expect.arrayContaining([
        '/var/workflow/models/activationmodel',
        '/var/workflow/models/publish_example'
      ])
    );
  });
});

describe('startWorkflow instance path', () => {
  it('returns the instance path from the Location header', async () => {
    const { connector, author } = makeConnector();
    author.resources.set('/content/mysite/en', { 'jcr:primaryType': 'cq:Page' });
    const result = await connector.workflows.startWorkflow({
      model: '/var/workflow/models/request_for_activation',
      payloadPath: '/content/mysite/en'
    });
    expect(result.data.instancePath).toBe(
      '/var/workflow/instances/server0/2026-01-01/request_for_activation_1'
    );
  });
});

describe('replicate agent errors', () => {
  it('fails closed when replicate.json body shows publish connection refused', async () => {
    const author = new FakeAuthor();
    author.succeedNextPost(
      '<html>Replication failed: Connection refused to http://localhost:4503/bin/receive</html>'
    );
    const { connector } = makeConnector(author);
    await expect(
      connector.pages.activatePage({ pagePath: '/content/mysite/en' })
    ).rejects.toThrow(/replicat|4503|refused/i);
  });

  it('returns success with a warning when Author reports success without queue details', async () => {
    const author = new FakeAuthor();
    author.succeedNextPost({ success: true });
    const { connector } = makeConnector(author);
    const result = await connector.pages.activatePage({ pagePath: '/content/mysite/en' });
    expect(result.success).toBe(true);
    expect(result.data.warning).toMatch(/queue|agent/i);
  });
});

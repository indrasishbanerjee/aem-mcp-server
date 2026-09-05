import { describe, expect, it } from '@jest/globals';
import { makeConnector } from './helpers.js';
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

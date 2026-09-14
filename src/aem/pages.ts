import type { AppConfig } from '../config.js';
import { AEM_ERROR_CODES, AemError } from '../errors.js';
import type { AemHttpClient } from './client.js';
import {
  asRecord,
  clampDepth,
  clampLimit,
  ok,
  pageNameFromTitle,
  requirePath,
  systemKey,
  type SuccessEnvelope
} from './util.js';

export class PageOperations {
  constructor(
    private readonly client: AemHttpClient,
    private readonly config: AppConfig
  ) {}

  /**
   * Create a cq:Page via POST /bin/wcmcommand. Extra properties are applied only as
   * additional safe Sling fields and cannot overwrite cmd, parentPath, title, label, or template.
   */
  async createPage(input: {
    parentPath: string;
    title: string;
    template: string;
    name?: string;
    properties?: Record<string, unknown>;
  }): Promise<SuccessEnvelope<{ pagePath: string; title: string; templateUsed: string }>> {
    const parentPath = requirePath(input.parentPath, this.config);
    const template = requirePath(input.template, this.config);
    await this.client.getJson(template, 1);
    const name = pageNameFromTitle(input.title, input.name);
    const pagePath = `${parentPath}/${name}`;
    const fields: Record<string, string> = {
      cmd: 'createPage',
      parentPath,
      title: input.title,
      label: name,
      template
    };
    if (input.properties) {
      const extra = this.client.filterWritableProperties(input.properties);
      const reserved = new Set(['cmd', 'parentPath', 'title', 'label', 'template']);
      for (const [key, value] of Object.entries(extra)) {
        if (reserved.has(key)) {
          continue;
        }
        fields[key] = value;
      }
    }
    Object.assign(fields, {
      cmd: 'createPage',
      parentPath,
      title: input.title,
      label: name,
      template
    });
    await this.client.postForm('/bin/wcmcommand', fields);
    return ok('createPage', { pagePath, title: input.title, templateUsed: template });
  }

  async deletePage(input: {
    pagePath: string;
    force?: boolean;
  }): Promise<SuccessEnvelope<{ deletedPath: string }>> {
    const pagePath = requirePath(input.pagePath, this.config);
    await this.client.postForm('/bin/wcmcommand', {
      cmd: 'deletePage',
      path: pagePath,
      force: String(Boolean(input.force))
    });
    return ok('deletePage', { deletedPath: pagePath });
  }

  async listPages(input: { siteRoot?: string; depth?: number; limit?: number }): Promise<
    SuccessEnvelope<{
      siteRoot: string;
      pages: Array<Record<string, unknown>>;
      pageCount: number;
      more: boolean;
    }>
  > {
    const siteRoot = requirePath(input.siteRoot ?? this.config.aem.sitesRoot, this.config);
    const depth = clampDepth(input.depth, this.config);
    const limit = clampLimit(input.limit, this.config);
    const data = asRecord(
      await this.client.get('/bin/querybuilder.json', {
        path: siteRoot,
        type: 'cq:Page',
        'p.limit': limit,
        'p.hits': 'full',
        'p.guessTotal': 'true',
        'p.nodedepth': Math.min(depth, 2)
      })
    );
    const hits = Array.isArray(data.hits) ? (data.hits as Array<Record<string, unknown>>) : [];
    const pages = hits.map(hit => {
      const content = asRecord(hit['jcr:content']);
      const path = String(hit['jcr:path'] ?? hit.path ?? '');
      return {
        path,
        name: path.split('/').filter(Boolean).pop(),
        title: content['jcr:title'] ?? hit['jcr:content/jcr:title'] ?? hit.title,
        template: content['cq:template'] ?? hit['jcr:content/cq:template'],
        lastModified: content['cq:lastModified'] ?? hit['jcr:content/cq:lastModified'],
        resourceType: content['sling:resourceType'] ?? hit['jcr:content/sling:resourceType']
      };
    });
    return ok('listPages', {
      siteRoot,
      pages,
      pageCount: pages.length,
      more: Boolean(data.more)
    });
  }

  async getPageProperties(
    pagePathRaw: string
  ): Promise<SuccessEnvelope<{ pagePath: string; properties: Record<string, unknown> }>> {
    const pagePath = requirePath(pagePathRaw, this.config);
    const content = asRecord(await this.client.getJson(`${pagePath}/jcr:content`));
    return ok('getPageProperties', {
      pagePath,
      properties: {
        title: content['jcr:title'],
        description: content['jcr:description'],
        template: content['cq:template'],
        resourceType: content['sling:resourceType'],
        lastModified: content['cq:lastModified'],
        lastModifiedBy: content['cq:lastModifiedBy'],
        lastReplicationAction: content['cq:lastReplicationAction'],
        lastReplicated: content['cq:lastReplicated'],
        lastReplicatedBy: content['cq:lastReplicatedBy'],
        tags: content['cq:tags'] ?? []
      }
    });
  }

  async getPageContent(
    pagePathRaw: string,
    depth?: number
  ): Promise<SuccessEnvelope<{ pagePath: string; content: Record<string, unknown> }>> {
    const pagePath = requirePath(pagePathRaw, this.config);
    const bounded = clampDepth(depth, this.config);
    const content = asRecord(await this.client.getJson(pagePath, bounded));
    return ok('getPageContent', { pagePath, content: sanitizeTree(content) });
  }

  async getAllTextContent(
    pagePathRaw: string
  ): Promise<SuccessEnvelope<{ pagePath: string; textContent: Array<Record<string, unknown>> }>> {
    const pagePath = requirePath(pagePathRaw, this.config);
    const content = asRecord(await this.client.getJson(pagePath, clampDepth(undefined, this.config)));
    const textContent: Array<Record<string, unknown>> = [];
    walk(content, 'jcr:content', (node, path) => {
      if (node.text || node['jcr:title'] || node['jcr:description']) {
        textContent.push({
          path,
          title: node['jcr:title'],
          text: node.text,
          description: node['jcr:description']
        });
      }
    });
    return ok('getAllTextContent', { pagePath, textContent });
  }

  async getPageImages(
    pagePathRaw: string
  ): Promise<SuccessEnvelope<{ pagePath: string; images: Array<Record<string, unknown>> }>> {
    const pagePath = requirePath(pagePathRaw, this.config);
    const content = asRecord(await this.client.getJson(pagePath, clampDepth(undefined, this.config)));
    const images: Array<Record<string, unknown>> = [];
    walk(content, 'jcr:content', (node, path) => {
      if (node.fileReference || node.src) {
        images.push({
          path,
          fileReference: node.fileReference,
          src: node.src,
          alt: node.alt ?? node.altText,
          title: node['jcr:title'] ?? node.title
        });
      }
    });
    return ok('getPageImages', { pagePath, images });
  }

  async activatePage(input: {
    pagePath: string;
    activateTree?: boolean;
  }): Promise<SuccessEnvelope<{ activatedPath: string; activateTree: boolean; warning?: string }>> {
    return this.replicate(input.pagePath, 'Activate', Boolean(input.activateTree), 'activatePage');
  }

  async deactivatePage(input: {
    pagePath: string;
    deactivateTree?: boolean;
  }): Promise<
    SuccessEnvelope<{ deactivatedPath: string; deactivateTree: boolean; warning?: string }>
  > {
    const result = await this.replicate(
      input.pagePath,
      'Deactivate',
      Boolean(input.deactivateTree),
      'deactivatePage'
    );
    return ok('deactivatePage', {
      deactivatedPath: result.data.activatedPath,
      deactivateTree: result.data.activateTree,
      warning: result.data.warning
    });
  }

  private async replicate(
    pathRaw: string,
    cmd: 'Activate' | 'Deactivate',
    tree: boolean,
    operation: string
  ) {
    const pagePath = requirePath(pathRaw, this.config);
    const fields: Record<string, string> = {
      cmd,
      path: pagePath,
      ignoredeactivated: 'false',
      onlymodified: 'false'
    };
    if (this.config.aem.defaultAgent) {
      fields.agentId = this.config.aem.defaultAgent;
    }
    if (tree) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message:
          'Tree activate/deactivate is not exposed. Activate each path explicitly; deep=true is not equivalent to Manage Publication tree activation.',
        statusCode: 400
      });
    }
    const body = await this.client.postForm('/bin/replicate.json', fields);
    const extra = inspectReplication(body);
    return ok(operation, { activatedPath: pagePath, activateTree: false, ...extra });
  }
}

function inspectReplication(body: unknown): { warning?: string } {
  if (body == null || body === '') {
    return {
      warning: 'Author returned no replication body; publish agent/queue status is not visible'
    };
  }
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const failed =
    /replication failed/i.test(text) ||
    /connection refused/i.test(text) ||
    /econnrefused/i.test(text) ||
    /cannot connect/i.test(text) ||
    /replicationexception/i.test(text) ||
    /agent[^\n]{0,80}(error|fail)/i.test(text);
  if (failed) {
    throw new AemError({
      code: AEM_ERROR_CODES.SYSTEM_ERROR,
      message: `Replication failed: ${text.slice(0, 400)}`,
      statusCode: 502,
      details: { replicateBody: text.slice(0, 400) }
    });
  }
  const record = asRecord(body);
  if (record.success === false || record.status === 'error' || record.status === 'ERROR') {
    throw new AemError({
      code: AEM_ERROR_CODES.SYSTEM_ERROR,
      message: `Replication failed: ${String(record.message ?? record.status ?? text.slice(0, 400))}`,
      statusCode: 502,
      details: { replicateBody: record }
    });
  }
  const hasQueue =
    record.queue !== undefined ||
    record.agents !== undefined ||
    record.agentId !== undefined ||
    record.status !== undefined;
  if (!hasQueue) {
    return {
      warning:
        'Author reported success; publish agent/queue details were not in the replicate response'
    };
  }
  return {};
}

function sanitizeTree(node: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('rep:') || key.startsWith('oak:')) {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeTree(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function walk(
  node: Record<string, unknown>,
  path: string,
  visit: (node: Record<string, unknown>, path: string) => void
): void {
  visit(node, path);
  for (const [key, value] of Object.entries(node)) {
    if (systemKey(key) || !value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    walk(value as Record<string, unknown>, `${path}/${key}`, visit);
  }
}

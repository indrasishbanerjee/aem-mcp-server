import type { AppConfig } from '../config.js';
import type { AemHttpClient } from './client.js';
import { asRecord, ok, requirePath, systemKey, type SuccessEnvelope } from './util.js';

export class DiscoveryOperations {
  constructor(
    private readonly client: AemHttpClient,
    private readonly config: AppConfig
  ) {}

  async fetchSites(): Promise<SuccessEnvelope<{ sites: Array<Record<string, unknown>> }>> {
    const data = asRecord(
      await this.client.getJson(this.config.aem.sitesRoot, 2)
    );
    const sites: Array<Record<string, unknown>> = [];
    for (const [key, value] of Object.entries(data)) {
      if (systemKey(key) || !value || typeof value !== 'object') {
        continue;
      }
      const node = value as Record<string, unknown>;
      const content = asRecord(node['jcr:content']);
      if (Object.keys(content).length === 0 && node['jcr:primaryType'] !== 'cq:Page') {
        continue;
      }
      sites.push({
        name: key,
        path: `${this.config.aem.sitesRoot}/${key}`,
        title: content['jcr:title'] ?? key,
        template: content['cq:template']
      });
    }
    return ok('fetchSites', { sites });
  }

  async fetchLanguageMasters(
    site: string
  ): Promise<SuccessEnvelope<{ site: string; languageMasters: Array<Record<string, unknown>> }>> {
    const sitePath = requirePath(`${this.config.aem.sitesRoot}/${site}`, this.config);
    const data = asRecord(await this.client.getJson(sitePath, 2));
    const languageMasters: Array<Record<string, unknown>> = [];
    for (const [key, value] of Object.entries(data)) {
      if (systemKey(key) || !value || typeof value !== 'object') {
        continue;
      }
      const node = value as Record<string, unknown>;
      const content = asRecord(node['jcr:content']);
      languageMasters.push({
        name: key,
        path: `${sitePath}/${key}`,
        title: content['jcr:title'] ?? key,
        language: content['jcr:language'] ?? key
      });
    }
    return ok('fetchLanguageMasters', { site, languageMasters });
  }

  async fetchAvailableLocales(
    site: string,
    languageMasterPath: string
  ): Promise<SuccessEnvelope<{ availableLocales: Array<Record<string, unknown>> }>> {
    const path = requirePath(languageMasterPath, this.config);
    const data = asRecord(await this.client.getJson(path, 2));
    const availableLocales: Array<Record<string, unknown>> = [];
    for (const [key, value] of Object.entries(data)) {
      if (systemKey(key) || !value || typeof value !== 'object') {
        continue;
      }
      const node = value as Record<string, unknown>;
      const content = asRecord(node['jcr:content']);
      availableLocales.push({
        name: key,
        title: content['jcr:title'] ?? key,
        language: content['jcr:language'] ?? key
      });
    }
    return ok('fetchAvailableLocales', { availableLocales });
  }

  async listChildren(
    pathRaw: string
  ): Promise<SuccessEnvelope<{ children: Array<Record<string, unknown>> }>> {
    const path = requirePath(pathRaw, this.config);
    const data = asRecord(await this.client.getJson(path, 1));
    const children: Array<Record<string, unknown>> = [];
    for (const [key, value] of Object.entries(data)) {
      if (systemKey(key) || key === 'jcr:content' || !value || typeof value !== 'object') {
        continue;
      }
      const node = value as Record<string, unknown>;
      const content = asRecord(node['jcr:content']);
      children.push({
        name: key,
        path: `${path}/${key}`,
        primaryType: node['jcr:primaryType'],
        title: content['jcr:title'] ?? node['jcr:title'] ?? key
      });
    }
    return ok('listChildren', { children });
  }

  async getTemplates(
    sitePathRaw?: string
  ): Promise<SuccessEnvelope<{ templates: Array<Record<string, unknown>>; source: string }>> {
    const constructed = sitePathRaw
      ? `/conf${requirePath(sitePathRaw, this.config).replace(/^\/content/, '')}/settings/wcm/templates`
      : `${this.config.aem.templatesRoot}/global/settings/wcm/templates`;
    const templatesPath = requirePath(constructed, this.config);
    const data = asRecord(await this.client.getJson(templatesPath, 2));
    const templates: Array<Record<string, unknown>> = [];
    for (const [key, value] of Object.entries(data)) {
      if (systemKey(key) || !value || typeof value !== 'object') {
        continue;
      }
      const node = value as Record<string, unknown>;
      const content = asRecord(node['jcr:content']);
      templates.push({
        name: key,
        path: `${templatesPath}/${key}`,
        title: content['jcr:title'] ?? key,
        description: content['jcr:description'],
        status: content.status ?? 'enabled',
        ranking: content.ranking ?? 0,
        allowedPaths: content.allowedPaths ?? []
      });
    }
    return ok('getTemplates', { templates, source: templatesPath });
  }

  async getTemplateStructure(
    templatePathRaw: string
  ): Promise<SuccessEnvelope<{ templatePath: string; structure: Record<string, unknown> }>> {
    const templatePath = requirePath(templatePathRaw, this.config);
    const data = asRecord(await this.client.getJson(templatePath, this.config.aem.maxDepth));
    const content = asRecord(data['jcr:content']);
    return ok('getTemplateStructure', {
      templatePath,
      structure: {
        properties: content,
        structure: asRecord(data.structure),
        initial: asRecord(data.initial),
        policies: asRecord(data.policies)
      }
    });
  }

  async testConnection(): Promise<boolean> {
    const data = asRecord(await this.client.get('/libs/granite/csrf/token.json'));
    return Boolean(data.token) || Object.keys(data).length > 0;
  }
}

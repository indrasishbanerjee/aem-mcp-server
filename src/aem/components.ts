import type { AppConfig } from '../config.js';
import { AEM_ERROR_CODES, AemError } from '../errors.js';
import { isPrefix } from '../security/paths.js';
import type { AemHttpClient } from './client.js';
import { asRecord, ok, requirePath, systemKey, type SuccessEnvelope } from './util.js';

export class ComponentOperations {
  constructor(
    private readonly client: AemHttpClient,
    private readonly config: AppConfig
  ) {}

  async createComponent(input: {
    pagePath: string;
    componentType: string;
    resourceType?: string;
    name?: string;
    parentPath?: string;
    properties?: Record<string, unknown>;
  }): Promise<SuccessEnvelope<{ componentPath: string; resourceType: string }>> {
    const pagePath = requirePath(input.pagePath, this.config);
    const mappedType = this.config.aem.componentResourceTypes[input.componentType];
    if (!this.config.aem.allowedComponentTypes.includes(input.componentType) || !mappedType) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message: `Component type '${input.componentType}' is not in the allowlist`,
        statusCode: 400,
        details: { allowed: this.config.aem.allowedComponentTypes }
      });
    }
    if (input.resourceType && input.resourceType !== mappedType) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message: `resourceType must be '${mappedType}' for component type '${input.componentType}'`,
        statusCode: 400
      });
    }
    const resourceType = mappedType;
    const contentRoot = `${pagePath}/jcr:content`;
    const container = input.parentPath
      ? requirePath(input.parentPath, this.config)
      : `${contentRoot}/${this.config.aem.defaultContainer}`;
    if (!isPrefix(contentRoot, container)) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message: 'parentPath must be under the page jcr:content tree',
        statusCode: 400
      });
    }
    const name =
      input.name && /^[a-zA-Z0-9_-]+$/.test(input.name)
        ? input.name
        : `${input.componentType}_${Date.now()}`;
    const componentPath = `${container}/${name}`;
    const fields = this.client.filterWritableProperties(
      {
        'jcr:primaryType': 'nt:unstructured',
        ...(input.properties ?? {})
      },
      { allowPrimaryType: true }
    );
    fields['sling:resourceType'] = resourceType;
    await this.client.postForm(componentPath, fields);
    return ok('createComponent', { componentPath, resourceType });
  }

  async updateComponent(input: {
    componentPath: string;
    properties: Record<string, unknown>;
    ifMatch?: string;
  }): Promise<SuccessEnvelope<{ path: string; updated: string[] }>> {
    const componentPath = requirePath(input.componentPath, this.config);
    const current = asRecord(await this.client.get(`${componentPath}.json`));
    if (input.ifMatch) {
      const lastModified = String(current['cq:lastModified'] ?? current['jcr:lastModified'] ?? '');
      if (!lastModified || lastModified !== input.ifMatch) {
        throw new AemError({
          code: AEM_ERROR_CODES.CONFLICT,
          message: lastModified
            ? 'Component was modified after the supplied ifMatch precondition'
            : 'ifMatch was supplied but the component has no lastModified stamp',
          statusCode: 409,
          details: { path: componentPath, ifMatch: input.ifMatch, lastModified }
        });
      }
    }
    const fields = this.client.filterWritableProperties(input.properties);
    if (Object.keys(fields).length === 0) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message: 'No writable properties supplied',
        statusCode: 400
      });
    }
    await this.client.postForm(componentPath, fields);
    return ok('updateComponent', { path: componentPath, updated: Object.keys(input.properties) });
  }

  async deleteComponent(input: {
    componentPath: string;
  }): Promise<SuccessEnvelope<{ deletedPath: string }>> {
    const componentPath = requirePath(input.componentPath, this.config);
    await this.client.postForm(componentPath, { ':operation': 'delete' });
    return ok('deleteComponent', { deletedPath: componentPath });
  }

  async scanPageComponents(
    pagePathRaw: string
  ): Promise<SuccessEnvelope<{ pagePath: string; components: Array<Record<string, unknown>> }>> {
    const pagePath = requirePath(pagePathRaw, this.config);
    const content = asRecord(await this.client.getJson(pagePath, this.config.aem.maxDepth));
    const components: Array<Record<string, unknown>> = [];
    const visit = (node: Record<string, unknown>, path: string): void => {
      if (typeof node['sling:resourceType'] === 'string') {
        const properties: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(node)) {
          if (!systemKey(key) && (typeof value !== 'object' || value === null)) {
            properties[key] = value;
          }
        }
        components.push({
          path,
          resourceType: node['sling:resourceType'],
          properties
        });
      }
      for (const [key, value] of Object.entries(node)) {
        if (systemKey(key) || !value || typeof value !== 'object' || Array.isArray(value)) {
          continue;
        }
        visit(value as Record<string, unknown>, `${path}/${key}`);
      }
    };
    visit(
      (content['jcr:content'] as Record<string, unknown>) ?? content,
      `${pagePath}/jcr:content`
    );
    return ok('scanPageComponents', { pagePath, components });
  }

  async bulkUpdateComponents(input: {
    updates: Array<{ componentPath: string; properties: Record<string, unknown> }>;
    continueOnError?: boolean;
  }): Promise<
    SuccessEnvelope<{ results: Array<Record<string, unknown>>; successful: number; failed: number }>
  > {
    if (!input.updates?.length) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message: 'updates is required',
        statusCode: 400
      });
    }
    const results: Array<Record<string, unknown>> = [];
    let successful = 0;
    for (const update of input.updates) {
      try {
        const result = await this.updateComponent(update);
        results.push({
          componentPath: update.componentPath,
          success: true,
          path: result.data.path
        });
        successful += 1;
      } catch (error) {
        results.push({
          componentPath: update.componentPath,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
        if (!input.continueOnError) {
          break;
        }
      }
    }
    return ok('bulkUpdateComponents', {
      results,
      successful,
      failed: results.length - successful
    });
  }

  async updateImagePath(
    componentPath: string,
    newImagePath: string
  ): Promise<SuccessEnvelope<{ path: string; updated: string[] }>> {
    requirePath(newImagePath, this.config);
    return this.updateComponent({
      componentPath,
      properties: { fileReference: newImagePath }
    });
  }
}

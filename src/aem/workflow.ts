import type { AppConfig } from '../config.js';
import { AEM_ERROR_CODES, AemError } from '../errors.js';
import type { AemHttpClient } from './client.js';
import { asRecord, clampLimit, ok, requirePath, type SuccessEnvelope } from './util.js';

export class WorkflowOperations {
  constructor(
    private readonly client: AemHttpClient,
    private readonly config: AppConfig
  ) {}

  async startWorkflow(input: {
    model: string;
    payloadPath: string;
    title?: string;
    comment?: string;
  }): Promise<SuccessEnvelope<{ model: string; payloadPath: string; title?: string }>> {
    const payloadPath = requirePath(input.payloadPath, this.config);
    await this.client.get(`${payloadPath}.json`, { ':depth': 0 });
    await this.client.postForm('/etc/workflow/instances', {
      model: input.model,
      payloadType: 'JCR_PATH',
      payload: payloadPath,
      workflowTitle: input.title || `MCP ${payloadPath}`
    });
    return ok('startWorkflow', {
      model: input.model,
      payloadPath,
      title: input.title
    });
  }

  async getWorkflowStatus(
    workflowId: string
  ): Promise<SuccessEnvelope<{ workflowId: string; data: Record<string, unknown> }>> {
    const path = workflowInstancePath(workflowId);
    const data = asRecord(await this.client.get(`${path}.json`, { ':depth': 2 }));
    return ok('getWorkflowStatus', { workflowId: path, data });
  }

  async listActiveWorkflows(
    limit?: number
  ): Promise<SuccessEnvelope<{ workflows: unknown[]; more: boolean }>> {
    const data = asRecord(
      await this.client.get('/bin/querybuilder.json', {
        path: '/var/workflow/instances',
        type: 'cq:Workflow',
        '1_property': 'status',
        '1_property.value': 'RUNNING',
        'p.limit': clampLimit(limit, this.config),
        'p.guessTotal': true,
        'p.hits': 'full'
      })
    );
    return ok('listActiveWorkflows', {
      workflows: Array.isArray(data.hits) ? data.hits : [],
      more: Boolean(data.hasMore)
    });
  }

  async cancelWorkflow(
    workflowId: string,
    _reason?: string
  ): Promise<SuccessEnvelope<{ workflowId: string; status: string }>> {
    const path = workflowInstancePath(workflowId);
    await this.client.postForm(path, { state: 'ABORTED' });
    return ok('cancelWorkflow', { workflowId: path, status: 'ABORTED' });
  }

  async suspendWorkflow(
    workflowId: string,
    _reason?: string
  ): Promise<SuccessEnvelope<{ workflowId: string; status: string }>> {
    const path = workflowInstancePath(workflowId);
    await this.client.postForm(path, { state: 'SUSPENDED' });
    return ok('suspendWorkflow', { workflowId: path, status: 'SUSPENDED' });
  }

  async resumeWorkflow(
    workflowId: string
  ): Promise<SuccessEnvelope<{ workflowId: string; status: string }>> {
    const path = workflowInstancePath(workflowId);
    await this.client.postForm(path, { state: 'RUNNING' });
    return ok('resumeWorkflow', { workflowId: path, status: 'RUNNING' });
  }

  async getWorkflowModels(): Promise<SuccessEnvelope<{ models: Array<Record<string, unknown>> }>> {
    const roots = [
      '/var/workflow/models',
      '/conf/global/settings/workflow/models',
      '/etc/workflow/models'
    ];
    const models: Array<Record<string, unknown>> = [];
    for (const root of roots) {
      try {
        const data = asRecord(await this.client.get(`${root}.json`, { ':depth': 2 }));
        for (const [key, value] of Object.entries(data)) {
          if (
            key.startsWith('jcr:') ||
            key.startsWith('sling:') ||
            !value ||
            typeof value !== 'object'
          ) {
            continue;
          }
          const node = value as Record<string, unknown>;
          const content = asRecord(node['jcr:content']);
          models.push({
            modelId: `${root}/${key}`,
            title: content['jcr:title'] ?? key
          });
        }
      } catch {
        continue;
      }
    }
    return ok('getWorkflowModels', { models });
  }
}

export class VersionOperations {
  constructor(
    private readonly client: AemHttpClient,
    private readonly config: AppConfig
  ) {}

  async getVersionHistory(
    pathRaw: string
  ): Promise<SuccessEnvelope<{ path: string; versions: unknown }>> {
    const path = requirePath(pathRaw, this.config);
    const data = await this.client.get(`${path}.versionhistory.json`, { ':depth': 2 });
    return ok('getVersionHistory', { path, versions: data });
  }

  async createVersion(
    pathRaw: string,
    label?: string,
    comment?: string
  ): Promise<SuccessEnvelope<{ path: string; label?: string }>> {
    const path = requirePath(pathRaw, this.config);
    const fields: Record<string, string> = { cmd: 'createVersion', path };
    if (label) {
      fields.label = label;
    }
    if (comment) {
      fields.comment = comment;
    }
    await this.client.postForm('/bin/wcmcommand', fields);
    return ok('createVersion', { path, label });
  }

  async restoreVersion(
    pathRaw: string,
    versionName: string
  ): Promise<SuccessEnvelope<{ path: string; versionName: string }>> {
    const path = requirePath(pathRaw, this.config);
    await this.client.postForm('/bin/wcmcommand', {
      cmd: 'restoreVersion',
      path,
      version: versionName
    });
    return ok('restoreVersion', { path, versionName });
  }
}

function workflowInstancePath(id: string): string {
  if (!id || id.includes('..') || /[?#\\]/.test(id)) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PARAMETERS,
      message: 'Invalid workflow id',
      statusCode: 400
    });
  }
  if (id.startsWith('/var/workflow/instances/') || id.startsWith('/etc/workflow/instances/')) {
    return id.replace(/\/+$/, '');
  }
  if (id.includes('/')) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PARAMETERS,
      message: 'Workflow id must be an instance name or an /etc|/var workflow instance path',
      statusCode: 400
    });
  }
  return `/var/workflow/instances/${id}`;
}

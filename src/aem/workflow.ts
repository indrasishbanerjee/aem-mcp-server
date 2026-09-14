import type { AppConfig } from '../config.js';
import { AEM_ERROR_CODES, AemError } from '../errors.js';
import { assertAllowedPath, canonicalizeJcrPath, isPrefix } from '../security/paths.js';
import type { AemHttpClient } from './client.js';
import { asRecord, clampLimit, ok, requirePath, slingCollection, type SuccessEnvelope } from './util.js';

const WORKFLOW_INSTANCE_ROOTS = ['/var/workflow/instances', '/etc/workflow/instances'];
const WORKFLOW_MODEL_ROOTS = ['/var/workflow/models', '/etc/workflow/models'];

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
  }): Promise<
    SuccessEnvelope<{ model: string; payloadPath: string; title?: string; instancePath?: string }>
  > {
    const payloadPath = requirePath(input.payloadPath, this.config);
    const model = requireWorkflowModelPath(input.model);
    await this.client.getJson(payloadPath, 0);
    const posted = await this.client.postFormResult('/etc/workflow/instances', {
      model,
      payloadType: 'JCR_PATH',
      payload: payloadPath,
      workflowTitle: input.title || `MCP ${payloadPath}`
    });
    return ok('startWorkflow', {
      model,
      payloadPath,
      title: input.title,
      instancePath: instancePathFromStart(posted)
    });
  }

  async getWorkflowStatus(
    workflowId: string
  ): Promise<SuccessEnvelope<{ workflowId: string; data: Record<string, unknown> }>> {
    const path = workflowInstancePath(workflowId);
    const data = asRecord(await this.client.getJson(path, 2));
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
      more: Boolean(data.more)
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
    const seen = new Set<string>();
    for (const root of roots) {
      try {
        const data: unknown = await this.client.getJson(root);
        for (const model of modelsFromPayload(data, root)) {
          const modelId = String(model.modelId);
          if (seen.has(modelId)) {
            continue;
          }
          seen.add(modelId);
          models.push(model);
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
    const data = await this.client.get('/bin/wcm/versions.json', { path });
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
  const raw = id.startsWith('/') ? id : `/var/workflow/instances/${id}`;
  return assertAllowedPath(raw, { allowedRoots: WORKFLOW_INSTANCE_ROOTS, maxDepth: 32 });
}

function requireWorkflowModelPath(raw: string): string {
  const path = canonicalizeJcrPath(raw);
  const allowed =
    WORKFLOW_MODEL_ROOTS.some(root => isPrefix(root, path)) ||
    (isPrefix('/conf', path) && /\/workflow\/models(\/|$)/.test(path));
  if (!allowed) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PATH,
      message: `Workflow model path '${path}' is outside allowed model roots`,
      statusCode: 400
    });
  }
  return path;
}

function jcrUri(uri: string): string {
  return uri.replace(/^https?:\/\/[^/]+/i, '').split('?')[0] ?? uri;
}

function instancePathFromStart(posted: {
  data: unknown;
  headers: Record<string, string>;
}): string | undefined {
  const record = asRecord(posted.data);
  const candidates = [
    posted.headers.location,
    posted.headers.Location,
    record.path,
    record.instancePath,
    record.workflowId
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) {
      continue;
    }
    const path = jcrUri(candidate.trim());
    if (!path.startsWith('/')) {
      continue;
    }
    try {
      return workflowInstancePath(path);
    } catch {
      return path;
    }
  }
  return undefined;
}

function modelsFromPayload(data: unknown, root: string): Array<Record<string, unknown>> {
  const fromList = slingCollection(data);
  if (fromList.length > 0) {
    return fromList
      .map(item => modelEntry(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }
  const models: Array<Record<string, unknown>> = [];
  for (const [key, value] of Object.entries(asRecord(data))) {
    if (key.startsWith('jcr:') || key.startsWith('sling:') || key.startsWith('{')) {
      continue;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const node = value as Record<string, unknown>;
    const content = asRecord(node['jcr:content']);
    models.push({
      modelId: `${root}/${key}`,
      title: content['jcr:title'] ?? key
    });
  }
  return models;
}

function modelEntry(item: unknown): Record<string, unknown> | undefined {
  if (typeof item === 'string') {
    const modelId = jcrUri(item);
    return { modelId, title: modelId.split('/').filter(Boolean).pop() };
  }
  const record = asRecord(item);
  const uri = record.uri ?? record.modelId ?? record.id ?? record.wid;
  if (typeof uri !== 'string' || !uri) {
    return undefined;
  }
  const modelId = jcrUri(uri);
  return {
    modelId,
    title: record.title ?? record['jcr:title'] ?? modelId.split('/').filter(Boolean).pop()
  };
}

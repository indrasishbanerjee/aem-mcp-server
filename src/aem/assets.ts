import type { AppConfig } from '../config.js';
import { AEM_ERROR_CODES, AemError } from '../errors.js';
import { assertSafeSlingFieldName } from '../security/sling-fields.js';
import type { AemHttpClient } from './client.js';
import { asRecord, ok, requirePath, type SuccessEnvelope } from './util.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/html',
  'text/xml',
  'application/xml',
  'application/json'
]);

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  xml: 'application/xml',
  json: 'application/json'
};

export class AssetOperations {
  constructor(
    private readonly client: AemHttpClient,
    private readonly config: AppConfig
  ) {}

  async uploadAsset(input: {
    parentPath: string;
    fileName: string;
    fileContent: string;
    mimeType?: string;
    metadata?: Record<string, string>;
  }): Promise<SuccessEnvelope<{ assetPath: string; fileName: string }>> {
    const parentPath = requirePath(input.parentPath, this.config);
    if (!/^[A-Za-z0-9._-]+$/.test(input.fileName)) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message: 'fileName contains illegal characters',
        statusCode: 400
      });
    }
    const mimeType = resolveMimeType(input.fileName, input.mimeType);
    const binary = decodeFileContent(input.fileContent);
    if (binary.byteLength > this.config.aem.maxUploadBytes) {
      throw new AemError({
        code: AEM_ERROR_CODES.PAYLOAD_TOO_LARGE,
        message: `File exceeds ${this.config.aem.maxUploadBytes} bytes`,
        statusCode: 413
      });
    }
    const form = new FormData();
    const blob = new Blob([new Uint8Array(binary)], { type: mimeType });
    form.append('file', blob, input.fileName);
    form.append('mimeType', mimeType);
    await this.client.postMultipart(`${parentPath}.createasset.html`, form);
    const assetPath = `${parentPath}/${input.fileName}`;
    if (input.metadata) {
      await this.client.postForm(assetPath, metadataFields(input.metadata));
    }
    return ok('uploadAsset', { assetPath, fileName: input.fileName });
  }

  async updateAsset(input: {
    assetPath: string;
    metadata?: Record<string, string>;
  }): Promise<SuccessEnvelope<{ assetPath: string }>> {
    const assetPath = requirePath(input.assetPath, this.config);
    if (!input.metadata || Object.keys(input.metadata).length === 0) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message: 'metadata is required for updateAsset',
        statusCode: 400
      });
    }
    await this.client.postForm(assetPath, metadataFields(input.metadata));
    return ok('updateAsset', { assetPath });
  }

  async deleteAsset(input: {
    assetPath: string;
  }): Promise<SuccessEnvelope<{ deletedPath: string }>> {
    const assetPath = requirePath(input.assetPath, this.config);
    await this.client.postForm(assetPath, { ':operation': 'delete' });
    return ok('deleteAsset', { deletedPath: assetPath });
  }

  async getAssetMetadata(
    assetPathRaw: string
  ): Promise<SuccessEnvelope<{ assetPath: string; metadata: Record<string, unknown> }>> {
    const assetPath = requirePath(assetPathRaw, this.config);
    const data = asRecord(await this.client.get(`${assetPath}/jcr:content/metadata.json`));
    return ok('getAssetMetadata', { assetPath, metadata: data });
  }
}

function metadataFields(metadata: Record<string, string>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    assertSafeSlingFieldName(key);
    fields[`jcr:content/metadata/${key}`] = value;
  }
  return fields;
}

function resolveMimeType(fileName: string, mimeType?: string): string {
  if (mimeType) {
    const normalized = mimeType.trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(normalized)) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message: `MIME type '${mimeType}' is not allowed`,
        statusCode: 400
      });
    }
    return normalized;
  }
  const ext = fileName.includes('.') ? (fileName.split('.').pop() ?? '').toLowerCase() : '';
  const inferred = EXTENSION_MIME_TYPES[ext];
  if (!inferred) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PARAMETERS,
      message:
        'MIME type is required for this file; unknown types are not uploaded as application/octet-stream',
      statusCode: 400
    });
  }
  return inferred;
}

function decodeFileContent(fileContent: string): Buffer {
  const base64 = fileContent.includes(',')
    ? (fileContent.split(',')[1] ?? fileContent)
    : fileContent;
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PARAMETERS,
      message: 'fileContent must be base64 or a data URI',
      statusCode: 400
    });
  }
}

import type { AppConfig } from '../config.js';
import { AEM_ERROR_CODES, AemError } from '../errors.js';
import type { AemHttpClient } from './client.js';
import { asRecord, ok, requirePath, type SuccessEnvelope } from './util.js';

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
    const binary = decodeFileContent(input.fileContent);
    if (binary.byteLength > this.config.aem.maxUploadBytes) {
      throw new AemError({
        code: AEM_ERROR_CODES.PAYLOAD_TOO_LARGE,
        message: `File exceeds ${this.config.aem.maxUploadBytes} bytes`,
        statusCode: 413
      });
    }
    const form = new FormData();
    const blob = new Blob([new Uint8Array(binary)], {
      type: input.mimeType || 'application/octet-stream'
    });
    form.append('file', blob, input.fileName);
    if (input.mimeType) {
      form.append('mimeType', input.mimeType);
    }
    await this.client.postMultipart(`${parentPath}.createasset.html`, form);
    const assetPath = `${parentPath}/${input.fileName}`;
    if (input.metadata) {
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(input.metadata)) {
        fields[`jcr:content/metadata/${key}`] = value;
      }
      await this.client.postForm(assetPath, fields);
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
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.metadata)) {
      fields[`jcr:content/metadata/${key}`] = value;
    }
    await this.client.postForm(assetPath, fields);
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

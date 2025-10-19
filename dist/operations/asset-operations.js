/**
 * Asset Operations Module
 * Handles all AEM DAM (Digital Asset Management) operations including upload, update, delete, and metadata management
 */
import { createAEMError, handleAEMHttpError, safeExecute, createSuccessResponse, AEM_ERROR_CODES, isValidContentPath } from '../error-handler.js';
export class AssetOperations {
    httpClient;
    logger;
    config;
    constructor(httpClient, logger, config) {
        this.httpClient = httpClient;
        this.logger = logger;
        this.config = config;
    }
    /**
     * Upload a new asset to AEM DAM
     */
    async uploadAsset(request) {
        return safeExecute(async () => {
            const { parentPath, fileName, fileContent, mimeType, metadata = {} } = request;
            if (!isValidContentPath(parentPath)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid parent path: ${String(parentPath)}`, { parentPath });
            }
            const assetPath = `${parentPath}/${fileName}`;
            try {
                // Use proper AEM DAM asset upload via Sling POST servlet
                const formData = new URLSearchParams();
                // Set the file content (base64 or binary)
                if (typeof fileContent === 'string') {
                    // Assume base64 encoded content
                    formData.append('file', fileContent);
                }
                else {
                    formData.append('file', String(fileContent));
                }
                // Set required Sling POST parameters for asset creation
                formData.append('fileName', fileName);
                formData.append(':operation', 'import');
                formData.append(':contentType', 'json');
                formData.append(':replace', 'true');
                formData.append('jcr:primaryType', 'dam:Asset');
                if (mimeType) {
                    formData.append('jcr:content/jcr:mimeType', mimeType);
                }
                // Add metadata to jcr:content/metadata node
                Object.entries(metadata).forEach(([key, value]) => {
                    formData.append(`jcr:content/metadata/${key}`, String(value));
                });
                const response = await this.httpClient.post(assetPath, formData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });
                // Verify the asset was created
                const verificationResponse = await this.httpClient.get(`${assetPath}.json`);
                return createSuccessResponse({
                    success: true,
                    assetPath,
                    fileName,
                    mimeType,
                    metadata,
                    uploadResponse: response.data,
                    assetData: verificationResponse.data,
                    timestamp: new Date().toISOString(),
                }, 'uploadAsset');
            }
            catch (error) {
                // Fallback to alternative DAM API if available
                try {
                    const damResponse = await this.httpClient.post('/api/assets' + parentPath, {
                        fileName,
                        fileContent,
                        mimeType,
                        metadata
                    });
                    return createSuccessResponse({
                        success: true,
                        assetPath,
                        fileName,
                        mimeType,
                        metadata,
                        uploadResponse: damResponse.data,
                        fallbackUsed: 'DAM API',
                        timestamp: new Date().toISOString(),
                    }, 'uploadAsset');
                }
                catch (fallbackError) {
                    throw handleAEMHttpError(error, 'uploadAsset');
                }
            }
        }, 'uploadAsset');
    }
    /**
     * Update an existing asset in AEM DAM
     */
    async updateAsset(request) {
        return safeExecute(async () => {
            const { assetPath, metadata, fileContent, mimeType } = request;
            if (!isValidContentPath(assetPath)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid asset path: ${String(assetPath)}`, { assetPath });
            }
            const formData = new URLSearchParams();
            // Update file content if provided
            if (fileContent) {
                formData.append('file', fileContent);
                if (mimeType) {
                    formData.append('jcr:content/jcr:mimeType', mimeType);
                }
            }
            // Update metadata if provided
            if (metadata && typeof metadata === 'object') {
                Object.entries(metadata).forEach(([key, value]) => {
                    formData.append(`jcr:content/metadata/${key}`, String(value));
                });
            }
            try {
                const response = await this.httpClient.post(assetPath, formData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });
                // Verify the update
                const verificationResponse = await this.httpClient.get(`${assetPath}.json`);
                return createSuccessResponse({
                    success: true,
                    assetPath,
                    fileName: assetPath.split('/').pop() || 'unknown',
                    updatedMetadata: metadata,
                    updateResponse: response.data,
                    assetData: verificationResponse.data,
                    timestamp: new Date().toISOString(),
                }, 'updateAsset');
            }
            catch (error) {
                throw handleAEMHttpError(error, 'updateAsset');
            }
        }, 'updateAsset');
    }
    /**
     * Delete an asset from AEM DAM
     */
    async deleteAsset(request) {
        return safeExecute(async () => {
            const { assetPath, force = false } = request;
            if (!isValidContentPath(assetPath)) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Invalid asset path: ${String(assetPath)}`, { assetPath });
            }
            await this.httpClient.delete(assetPath);
            return createSuccessResponse({
                success: true,
                deletedPath: assetPath,
                force,
                timestamp: new Date().toISOString(),
            }, 'deleteAsset');
        }, 'deleteAsset');
    }
    /**
     * Get asset metadata from AEM DAM
     */
    async getAssetMetadata(assetPath) {
        return safeExecute(async () => {
            const response = await this.httpClient.get(`${assetPath}.json`);
            const metadata = response.data['jcr:content']?.metadata || {};
            return createSuccessResponse({
                assetPath,
                metadata,
                fullData: response.data,
            }, 'getAssetMetadata');
        }, 'getAssetMetadata');
    }
}
//# sourceMappingURL=asset-operations.js.map
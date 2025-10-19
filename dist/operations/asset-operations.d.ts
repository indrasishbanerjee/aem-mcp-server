/**
 * Asset Operations Module
 * Handles all AEM DAM (Digital Asset Management) operations including upload, update, delete, and metadata management
 */
import { AxiosInstance } from 'axios';
import { IAEMConnector, UploadAssetRequest, UpdateAssetRequest, DeleteAssetRequest, AssetResponse, AssetMetadataResponse, DeleteResponse, ILogger, AEMConfig } from '../interfaces/index.js';
export declare class AssetOperations implements Partial<IAEMConnector> {
    private httpClient;
    private logger;
    private config;
    constructor(httpClient: AxiosInstance, logger: ILogger, config: AEMConfig);
    /**
     * Upload a new asset to AEM DAM
     */
    uploadAsset(request: UploadAssetRequest): Promise<AssetResponse>;
    /**
     * Update an existing asset in AEM DAM
     */
    updateAsset(request: UpdateAssetRequest): Promise<AssetResponse>;
    /**
     * Delete an asset from AEM DAM
     */
    deleteAsset(request: DeleteAssetRequest): Promise<DeleteResponse>;
    /**
     * Get asset metadata from AEM DAM
     */
    getAssetMetadata(assetPath: string): Promise<AssetMetadataResponse>;
}
//# sourceMappingURL=asset-operations.d.ts.map
/**
 * Replication Operations Module
 * Handles all AEM replication and publishing operations including activation, deactivation, and content distribution
 */
import { AxiosInstance } from 'axios';
import { IAEMConnector, ActivatePageRequest, DeactivatePageRequest, UnpublishContentRequest, ActivateResponse, DeactivateResponse, UnpublishResponse, ReplicateResponse, ILogger, AEMConfig } from '../interfaces/index.js';
export declare class ReplicationOperations implements Partial<IAEMConnector> {
    private httpClient;
    private logger;
    private config;
    constructor(httpClient: AxiosInstance, logger: ILogger, config: AEMConfig);
    /**
     * Activate (publish) a single page
     */
    activatePage(request: ActivatePageRequest): Promise<ActivateResponse>;
    /**
     * Deactivate (unpublish) a single page
     */
    deactivatePage(request: DeactivatePageRequest): Promise<DeactivateResponse>;
    /**
     * Unpublish content from the publish environment
     */
    unpublishContent(request: UnpublishContentRequest): Promise<UnpublishResponse>;
    /**
     * Replicate and publish content to selected locales with real AEM integration
     */
    replicateAndPublish(selectedLocales: string[], componentData: unknown, localizedOverrides?: unknown): Promise<ReplicateResponse>;
    /**
     * Validate and build locale-specific path
     */
    private validateAndBuildLocalePath;
    /**
     * Check if content is part of MSM (Multi-Site Manager) structure
     */
    private checkMSMStructure;
    /**
     * Handle MSM replication using live copy APIs
     */
    private handleMSMReplication;
    /**
     * Handle standard replication process
     */
    private handleStandardReplication;
    /**
     * Activate content in the target locale
     */
    private activateContentInLocale;
    /**
     * Rollback successful replications on failure
     */
    private rollbackSuccessfulReplications;
    /**
     * Get replication status for content
     */
    getReplicationStatus(contentPath: string): Promise<{
        contentPath: string;
        status: 'active' | 'inactive' | 'pending' | 'error';
        lastReplicated?: string;
        replicationAgent?: string;
        error?: string;
    }>;
    /**
     * Bulk activate multiple pages
     */
    bulkActivatePages(pagePaths: string[], activateTree?: boolean): Promise<{
        success: boolean;
        results: Array<{
            pagePath: string;
            success: boolean;
            error?: string;
        }>;
        totalPages: number;
        successfulActivations: number;
    }>;
    /**
     * Bulk deactivate multiple pages
     */
    bulkDeactivatePages(pagePaths: string[], deactivateTree?: boolean): Promise<{
        success: boolean;
        results: Array<{
            pagePath: string;
            success: boolean;
            error?: string;
        }>;
        totalPages: number;
        successfulDeactivations: number;
    }>;
}
//# sourceMappingURL=replication-operations.d.ts.map
/**
 * Version Operations Module
 * Handles all AEM version management operations including creating, restoring, comparing, and deleting versions
 */
import { AxiosInstance } from 'axios';
import { ILogger, AEMConfig } from '../interfaces/index.js';
export interface VersionInfo {
    name: string;
    label?: string;
    created: string;
    createdBy: string;
    comment?: string;
    isBaseVersion?: boolean;
}
export interface VersionHistoryResponse {
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
        path: string;
        versions: VersionInfo[];
        totalCount: number;
        baseVersion?: string;
    };
}
export interface CreateVersionResponse {
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
        path: string;
        versionName: string;
        label?: string;
        comment?: string;
        created: string;
        createdBy: string;
    };
}
export interface RestoreVersionResponse {
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
        path: string;
        restoredVersion: string;
        previousVersion?: string;
        restoredAt: string;
        restoredBy: string;
    };
}
export interface CompareVersionsResponse {
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
        path: string;
        version1: string;
        version2: string;
        differences: Array<{
            property: string;
            type: 'added' | 'removed' | 'modified';
            oldValue?: unknown;
            newValue?: unknown;
        }>;
        summary: {
            added: number;
            removed: number;
            modified: number;
        };
    };
}
export interface DeleteVersionResponse {
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
        path: string;
        deletedVersion: string;
        deletedAt: string;
        deletedBy: string;
    };
}
export declare class VersionOperations {
    private httpClient;
    private logger;
    private config;
    constructor(httpClient: AxiosInstance, logger: ILogger, config: AEMConfig);
    /**
     * Get version history for a content path
     */
    getVersionHistory(path: string): Promise<VersionHistoryResponse>;
    /**
     * Create a new version of content
     */
    createVersion(path: string, label?: string, comment?: string): Promise<CreateVersionResponse>;
    /**
     * Restore content to a specific version
     */
    restoreVersion(path: string, versionName: string): Promise<RestoreVersionResponse>;
    /**
     * Compare two versions of content
     */
    compareVersions(path: string, version1: string, version2: string): Promise<CompareVersionsResponse>;
    /**
     * Delete a specific version
     */
    deleteVersion(path: string, versionName: string): Promise<DeleteVersionResponse>;
    /**
     * Update undoChanges to use version operations
     */
    undoChanges(request: {
        jobId: string;
        path?: string;
    }): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            message: string;
            request: {
                jobId: string;
                path?: string;
            };
            versionInfo?: {
                restoredVersion: string;
                path: string;
            };
            timestamp: string;
        };
    }>;
    /**
     * Helper method to check out content
     */
    private checkOutContent;
    /**
     * Helper method to check in content
     */
    private checkInContent;
    /**
     * Helper method to compare version data
     */
    private compareVersionData;
}
//# sourceMappingURL=version-operations.d.ts.map
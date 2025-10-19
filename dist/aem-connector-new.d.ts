/**
 * Enhanced AEM Connector with modular architecture
 * Composes all operation modules for better maintainability and testability
 */
import { ILogger, IConfig, IAEMConnector } from './interfaces/index.js';
export declare class AEMConnector implements IAEMConnector {
    private config;
    private logger;
    private httpClient;
    private pageOps;
    private componentOps;
    private assetOps;
    private searchOps;
    private templateOps;
    private replicationOps;
    private utilityOps;
    private workflowOps;
    private versionOps;
    constructor(config: IConfig, logger: ILogger);
    /**
     * Test connection to AEM instance
     */
    testConnection(): Promise<boolean>;
    createPage(request: any): Promise<import("./interfaces/index.js").PageResponse>;
    deletePage(request: any): Promise<import("./interfaces/index.js").DeleteResponse>;
    listPages(siteRoot: string, depth?: number, limit?: number): Promise<import("./interfaces/index.js").ListPagesResponse>;
    getPageContent(pagePath: string): Promise<import("./interfaces/index.js").PageContentResponse>;
    getPageProperties(pagePath: string): Promise<import("./interfaces/index.js").PagePropertiesResponse>;
    activatePage(request: any): Promise<import("./interfaces/index.js").ActivateResponse>;
    deactivatePage(request: any): Promise<import("./interfaces/index.js").DeactivateResponse>;
    getAllTextContent(pagePath: string): Promise<import("./interfaces/index.js").TextContentResponse>;
    getPageTextContent(pagePath: string): Promise<import("./interfaces/index.js").TextContentResponse>;
    getPageImages(pagePath: string): Promise<import("./interfaces/index.js").ImagesResponse>;
    createComponent(request: any): Promise<import("./interfaces/index.js").ComponentResponse>;
    updateComponent(request: any): Promise<import("./interfaces/index.js").UpdateResponse>;
    deleteComponent(request: any): Promise<import("./interfaces/index.js").DeleteResponse>;
    validateComponent(request: any): Promise<import("./interfaces/index.js").ValidateResponse>;
    scanPageComponents(pagePath: string): Promise<import("./interfaces/index.js").ScanComponentsResponse>;
    bulkUpdateComponents(request: any): Promise<import("./interfaces/index.js").BulkUpdateResponse>;
    updateImagePath(componentPath: string, newImagePath: string): Promise<import("./interfaces/index.js").UpdateResponse>;
    uploadAsset(request: any): Promise<import("./interfaces/index.js").AssetResponse>;
    updateAsset(request: any): Promise<import("./interfaces/index.js").AssetResponse>;
    deleteAsset(request: any): Promise<import("./interfaces/index.js").DeleteResponse>;
    getAssetMetadata(assetPath: string): Promise<import("./interfaces/index.js").AssetMetadataResponse>;
    searchContent(params: any): Promise<import("./interfaces/index.js").SearchResponse>;
    executeJCRQuery(query: string, limit?: number): Promise<import("./interfaces/index.js").JCRQueryResponse>;
    enhancedPageSearch(params: any): Promise<import("./interfaces/index.js").SearchResponse>;
    getTemplates(sitePath?: string): Promise<import("./interfaces/index.js").TemplatesResponse>;
    getTemplateStructure(templatePath: string): Promise<import("./interfaces/index.js").TemplateStructureResponse>;
    replicateAndPublish(selectedLocales: any, componentData: any, localizedOverrides?: any): Promise<import("./interfaces/index.js").ReplicateResponse>;
    unpublishContent(request: any): Promise<import("./interfaces/index.js").UnpublishResponse>;
    getNodeContent(path: string, depth?: number): Promise<import("./interfaces/index.js").NodeContentResponse>;
    listChildren(path: string): Promise<import("./interfaces/index.js").ChildrenResponse>;
    fetchSites(): Promise<import("./interfaces/index.js").SitesResponse>;
    fetchLanguageMasters(site: string): Promise<import("./interfaces/index.js").LanguageMastersResponse>;
    fetchAvailableLocales(site: string, languageMasterPath: string): Promise<import("./interfaces/index.js").LocalesResponse>;
    createPageWithTemplate(request: any): Promise<import("./interfaces/index.js").PageResponse>;
    getAvailableTemplates(parentPath: string): Promise<import("./interfaces/index.js").TemplatesResponse>;
    validateTemplate(templatePath: string, targetPath: string): Promise<{
        templatePath: string;
        targetPath: string;
        isValid: boolean;
        templateTitle: string;
        templateDescription: string;
        allowedPaths: string[];
        restrictions: {
            hasPathRestrictions: boolean;
            allowedPaths: string[];
        };
    }>;
    getTemplateMetadata(templatePath: string, useCache?: boolean): Promise<any>;
    clearTemplateCache(): void;
    startWorkflow(request: any): Promise<import("./operations/workflow-operations.js").WorkflowResponse>;
    getWorkflowStatus(workflowId: string): Promise<import("./operations/workflow-operations.js").WorkflowStatusResponse>;
    completeWorkflowStep(workflowId: string, stepName: string, comment?: string): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            workflowId: string;
            stepName: string;
            comment?: string;
            status: string;
            completedAt: string;
        };
    }>;
    cancelWorkflow(workflowId: string, reason?: string): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            workflowId: string;
            reason?: string;
            status: string;
            cancelledAt: string;
        };
    }>;
    listActiveWorkflows(limit?: number): Promise<import("./operations/workflow-operations.js").WorkflowListResponse>;
    suspendWorkflow(workflowId: string, reason?: string): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            workflowId: string;
            reason?: string;
            status: string;
            suspendedAt: string;
        };
    }>;
    resumeWorkflow(workflowId: string): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            workflowId: string;
            status: string;
            resumedAt: string;
        };
    }>;
    getWorkflowModels(): Promise<import("./operations/workflow-operations.js").WorkflowModelResponse>;
    getVersionHistory(path: string): Promise<import("./operations/version-operations.js").VersionHistoryResponse>;
    createVersion(path: string, label?: string, comment?: string): Promise<import("./operations/version-operations.js").CreateVersionResponse>;
    restoreVersion(path: string, versionName: string): Promise<import("./operations/version-operations.js").RestoreVersionResponse>;
    compareVersions(path: string, version1: string, version2: string): Promise<import("./operations/version-operations.js").CompareVersionsResponse>;
    deleteVersion(path: string, versionName: string): Promise<import("./operations/version-operations.js").DeleteVersionResponse>;
    undoChanges(request: any): Promise<{
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
}
//# sourceMappingURL=aem-connector-new.d.ts.map
import { AxiosInstance } from 'axios';
import { AEMConfig } from './aem-config.js';
export interface AEMConnectorConfig {
    aem: {
        host: string;
        author: string;
        publish: string;
        serviceUser: {
            username: string;
            password: string;
        };
        endpoints: Record<string, string>;
    };
    mcp: {
        name: string;
        version: string;
    };
}
export declare class AEMConnector {
    config: AEMConnectorConfig;
    auth: {
        username: string;
        password: string;
    };
    aemConfig: AEMConfig;
    private workflowOps;
    private versionOps;
    constructor();
    loadConfig(): AEMConnectorConfig;
    createAxiosInstance(): AxiosInstance;
    testConnection(): Promise<boolean>;
    validateComponent(request: any): Promise<object>;
    validateComponentProps(pageData: any, componentType: string, props: any): {
        valid: boolean;
        errors: string[];
        warnings: string[];
        componentType: string;
        propsValidated: number;
    };
    updateComponent(request: any): Promise<object>;
    undoChanges(request: any): Promise<object>;
    startWorkflow(request: any): Promise<object>;
    getWorkflowStatus(workflowId: string): Promise<object>;
    completeWorkflowStep(workflowId: string, stepName: string, comment?: string): Promise<object>;
    cancelWorkflow(workflowId: string, reason?: string): Promise<object>;
    listActiveWorkflows(limit?: number): Promise<object>;
    suspendWorkflow(workflowId: string, reason?: string): Promise<object>;
    resumeWorkflow(workflowId: string): Promise<object>;
    getWorkflowModels(): Promise<object>;
    getVersionHistory(path: string): Promise<object>;
    createVersion(path: string, label?: string, comment?: string): Promise<object>;
    restoreVersion(path: string, versionName: string): Promise<object>;
    compareVersions(path: string, version1: string, version2: string): Promise<object>;
    deleteVersion(path: string, versionName: string): Promise<object>;
    enhancedPageSearch(params: any): Promise<object>;
    scanPageComponents(pagePath: string): Promise<object>;
    fetchSites(): Promise<object>;
    fetchLanguageMasters(site: string): Promise<object>;
    fetchAvailableLocales(site: string, languageMasterPath: string): Promise<object>;
    replicateAndPublish(selectedLocales: any, componentData: any, localizedOverrides: any): Promise<object>;
    getAllTextContent(pagePath: string): Promise<object>;
    getPageTextContent(pagePath: string): Promise<object>;
    getPageImages(pagePath: string): Promise<object>;
    updateImagePath(componentPath: string, newImagePath: string): Promise<object>;
    getPageContent(pagePath: string): Promise<object>;
    /**
     * List direct children under a path using AEM's JSON API.
     * Returns array of { name, path, primaryType, title }.
     */
    listChildren(path: string, depth?: number): Promise<any[]>;
    /**
     * List all cq:Page nodes under a site root, up to a given depth and limit.
     */
    listPages(siteRoot: string, depth?: number, limit?: number): Promise<object>;
    /**
     * Execute a QueryBuilder fulltext search for cq:Page nodes, with security validation.
     * Note: This is NOT a true JCR SQL2 executor. It wraps QueryBuilder and only supports fulltext queries.
     */
    executeJCRQuery(query: string, limit?: number): Promise<object>;
    getPageProperties(pagePath: string): Promise<object>;
    searchContent(params: any): Promise<object>;
    getAssetMetadata(assetPath: string): Promise<object>;
    createPage(request: any): Promise<object>;
    deletePage(request: any): Promise<object>;
    createComponent(request: any): Promise<object>;
    deleteComponent(request: any): Promise<object>;
    unpublishContent(request: any): Promise<object>;
    activatePage(request: any): Promise<object>;
    deactivatePage(request: any): Promise<object>;
    uploadAsset(request: any): Promise<object>;
    updateAsset(request: any): Promise<object>;
    deleteAsset(request: any): Promise<object>;
    getTemplates(sitePath?: string): Promise<object>;
    getTemplateStructure(templatePath: string): Promise<object>;
    /**
     * Bulk update multiple components with validation and rollback support.
     */
    bulkUpdateComponents(request: any): Promise<object>;
    /**
     * Legacy: Get JCR node content as raw JSON for a given path and depth.
     */
    getNodeContent(path: string, depth?: number): Promise<any>;
    /**
     * Enhanced getTemplates method with better template discovery and validation
     */
    getAvailableTemplates(parentPath: string): Promise<object>;
    /**
     * Enhanced createPage method with proper template handling and jcr:content creation
     */
    createPageWithTemplate(request: any): Promise<object>;
    /**
     * Validate template compatibility with target path
     */
    validateTemplate(templatePath: string, targetPath: string): Promise<object>;
    /**
     * Get template metadata and caching
     */
    private templateCache;
    private templateCacheExpiry;
    private readonly TEMPLATE_CACHE_TTL;
    getTemplateMetadata(templatePath: string, useCache?: boolean): Promise<object>;
    /**
     * Clear template cache
     */
    clearTemplateCache(): void;
}
//# sourceMappingURL=aem-connector.d.ts.map
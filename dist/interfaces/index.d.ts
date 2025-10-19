/**
 * Core interfaces for the AEM MCP Server
 * These interfaces define contracts for better testability and dependency injection
 */
export interface IHttpClient {
    get<T = unknown>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>;
    post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>;
    put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>;
    delete<T = unknown>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>;
}
export interface RequestConfig {
    headers?: Record<string, string>;
    timeout?: number;
    params?: Record<string, string | number>;
    auth?: {
        username: string;
        password: string;
    };
}
export interface HttpResponse<T> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
}
export interface ILogger {
    error(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    trace(message: string, context?: LogContext): void;
    methodStart(method: string, parameters: unknown, requestId?: string): void;
    methodEnd(method: string, duration: number, success: boolean, requestId?: string, result?: unknown): void;
    methodError(method: string, error: unknown, duration: number, requestId?: string, parameters?: unknown): void;
    httpRequest(method: string, url: string, statusCode: number, duration: number, requestId?: string): void;
    aemOperation(operation: string, path: string, success: boolean, duration: number, requestId?: string, details?: unknown): void;
    performance(operation: string, duration: number, metadata?: Record<string, unknown>): void;
    security(event: string, details: Record<string, unknown>, requestId?: string): void;
    health(component: string, status: 'healthy' | 'degraded' | 'unhealthy', details?: Record<string, unknown>): void;
}
export interface LogContext {
    method?: string;
    requestId?: string;
    userId?: string;
    duration?: number;
    error?: unknown;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface IConfig {
    aem: AEMConfig;
    mcp: MCPConfig;
    server: ServerConfig;
    security: SecurityConfig;
    logging: LoggingConfig;
}
export interface AEMConfig {
    host: string;
    author: string;
    publish: string;
    serviceUser: {
        username: string;
        password: string;
    };
    endpoints: {
        content: string;
        dam: string;
        query: string;
        crxde: string;
        jcr: string;
        replicate: string;
        wcmcommand: string;
    };
    contentPaths: {
        sitesRoot: string;
        assetsRoot: string;
        templatesRoot: string;
        experienceFragmentsRoot: string;
    };
    replication: {
        publisherUrls: string[];
        defaultReplicationAgent: string;
    };
    components: {
        allowedTypes: string[];
        defaultProperties: Record<string, unknown>;
    };
    queries: {
        maxLimit: number;
        defaultLimit: number;
        timeoutMs: number;
    };
    validation: {
        maxDepth: number;
        allowedLocales: string[];
    };
    siteName?: string;
    strictReplication?: boolean;
}
export interface MCPConfig {
    name: string;
    version: string;
    port: number;
    gatewayPort: number;
    username?: string;
    password?: string;
}
export interface ServerConfig {
    port: number;
    host: string;
    cors: {
        enabled: boolean;
        origins: string[];
    };
    rateLimit: {
        enabled: boolean;
        windowMs: number;
        maxRequests: number;
    };
}
export interface SecurityConfig {
    auth: {
        enabled: boolean;
        type: 'basic' | 'jwt' | 'api-key';
        jwtSecret?: string;
        apiKeyHeader?: string;
    };
    cors: {
        enabled: boolean;
        origins: string[];
        credentials: boolean;
    };
    headers: {
        enabled: boolean;
        hsts: boolean;
        noSniff: boolean;
        xssProtection: boolean;
    };
}
export interface LoggingConfig {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    enableConsole: boolean;
    enableFile: boolean;
    logDirectory: string;
    maxFileSize: number;
    maxFiles: number;
    enableStructuredLogging: boolean;
    enableCorrelation: boolean;
}
export interface IAEMConnector {
    testConnection(): Promise<boolean>;
    createPage(request: CreatePageRequest): Promise<PageResponse>;
    deletePage(request: DeletePageRequest): Promise<DeleteResponse>;
    listPages(siteRoot: string, depth?: number, limit?: number): Promise<ListPagesResponse>;
    getPageContent(pagePath: string): Promise<PageContentResponse>;
    getPageProperties(pagePath: string): Promise<PagePropertiesResponse>;
    activatePage(request: ActivatePageRequest): Promise<ActivateResponse>;
    deactivatePage(request: DeactivatePageRequest): Promise<DeactivateResponse>;
    createComponent(request: CreateComponentRequest): Promise<ComponentResponse>;
    updateComponent(request: UpdateComponentRequest): Promise<UpdateResponse>;
    deleteComponent(request: DeleteComponentRequest): Promise<DeleteResponse>;
    validateComponent(request: ValidateComponentRequest): Promise<ValidateResponse>;
    scanPageComponents(pagePath: string): Promise<ScanComponentsResponse>;
    bulkUpdateComponents(request: BulkUpdateComponentsRequest): Promise<BulkUpdateResponse>;
    uploadAsset(request: UploadAssetRequest): Promise<AssetResponse>;
    updateAsset(request: UpdateAssetRequest): Promise<AssetResponse>;
    deleteAsset(request: DeleteAssetRequest): Promise<DeleteResponse>;
    getAssetMetadata(assetPath: string): Promise<AssetMetadataResponse>;
    searchContent(params: SearchContentParams): Promise<SearchResponse>;
    executeJCRQuery(query: string, limit?: number): Promise<JCRQueryResponse>;
    enhancedPageSearch(params: EnhancedSearchParams): Promise<SearchResponse>;
    getTemplates(sitePath?: string): Promise<TemplatesResponse>;
    getTemplateStructure(templatePath: string): Promise<TemplateStructureResponse>;
    fetchSites(): Promise<SitesResponse>;
    fetchLanguageMasters(site: string): Promise<LanguageMastersResponse>;
    fetchAvailableLocales(site: string, languageMasterPath: string): Promise<LocalesResponse>;
    replicateAndPublish(selectedLocales: string[], componentData: unknown, localizedOverrides?: unknown): Promise<ReplicateResponse>;
    unpublishContent(request: UnpublishContentRequest): Promise<UnpublishResponse>;
    getNodeContent(path: string, depth?: number): Promise<NodeContentResponse>;
    listChildren(path: string): Promise<ChildrenResponse>;
    getAllTextContent(pagePath: string): Promise<TextContentResponse>;
    getPageTextContent(pagePath: string): Promise<TextContentResponse>;
    getPageImages(pagePath: string): Promise<ImagesResponse>;
    updateImagePath(componentPath: string, newImagePath: string): Promise<UpdateResponse>;
}
export interface CreatePageRequest {
    parentPath: string;
    title: string;
    template?: string;
    name?: string;
    properties?: Record<string, unknown>;
}
export interface DeletePageRequest {
    pagePath: string;
    force?: boolean;
}
export interface CreateComponentRequest {
    pagePath: string;
    componentType: string;
    resourceType: string;
    properties?: Record<string, unknown>;
    name?: string;
}
export interface UpdateComponentRequest {
    componentPath: string;
    properties: Record<string, unknown>;
}
export interface DeleteComponentRequest {
    componentPath: string;
    force?: boolean;
}
export interface ValidateComponentRequest {
    locale: string;
    pagePath: string;
    component: string;
    props: Record<string, unknown>;
}
export interface BulkUpdateComponentsRequest {
    updates: Array<{
        componentPath: string;
        properties: Record<string, unknown>;
    }>;
    validateFirst?: boolean;
    continueOnError?: boolean;
}
export interface UploadAssetRequest {
    parentPath: string;
    fileName: string;
    fileContent: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
}
export interface UpdateAssetRequest {
    assetPath: string;
    metadata?: Record<string, unknown>;
    fileContent?: string;
    mimeType?: string;
}
export interface DeleteAssetRequest {
    assetPath: string;
    force?: boolean;
}
export interface SearchContentParams {
    type?: string;
    fulltext?: string;
    path?: string;
    limit?: number;
}
export interface EnhancedSearchParams {
    searchTerm: string;
    basePath: string;
    includeAlternateLocales?: boolean;
}
export interface ActivatePageRequest {
    pagePath: string;
    activateTree?: boolean;
}
export interface DeactivatePageRequest {
    pagePath: string;
    deactivateTree?: boolean;
}
export interface UnpublishContentRequest {
    contentPaths: string[];
    unpublishTree?: boolean;
}
export interface BaseResponse {
    success: boolean;
    operation: string;
    timestamp: string;
    data: unknown;
}
export interface PageResponse extends BaseResponse {
    data: {
        pagePath: string;
        title: string;
        templateUsed?: string;
        jcrContentCreated: boolean;
        pageAccessible: boolean;
        creationDetails: {
            timestamp: string;
            steps: string[];
        };
    };
}
export interface DeleteResponse extends BaseResponse {
    data: {
        success: boolean;
        deletedPath: string;
        timestamp: string;
    };
}
export interface ListPagesResponse extends BaseResponse {
    data: {
        siteRoot: string;
        pages: Array<{
            name: string;
            path: string;
            primaryType: string;
            title: string;
            template?: string;
            lastModified?: string;
            lastModifiedBy?: string;
            resourceType?: string;
            type: string;
        }>;
        pageCount: number;
        depth: number;
        limit: number;
    };
}
export interface PageContentResponse extends BaseResponse {
    data: {
        pagePath: string;
        content: Record<string, unknown>;
    };
}
export interface PagePropertiesResponse extends BaseResponse {
    data: {
        pagePath: string;
        properties: {
            title?: string;
            description?: string;
            template?: string;
            lastModified?: string;
            lastModifiedBy?: string;
            created?: string;
            createdBy?: string;
            primaryType?: string;
            resourceType?: string;
            tags?: string[];
            properties: Record<string, unknown>;
        };
    };
}
export interface ComponentResponse extends BaseResponse {
    data: {
        success: boolean;
        componentPath: string;
        componentType: string;
        resourceType: string;
        properties: Record<string, unknown>;
        timestamp: string;
    };
}
export interface UpdateResponse extends BaseResponse {
    data: {
        message: string;
        path: string;
        properties: Record<string, unknown>;
        updatedProperties: Record<string, unknown>;
        verification: {
            success: boolean;
            propertiesChanged: number;
            timestamp: string;
        };
    };
}
export interface ValidateResponse extends BaseResponse {
    data: {
        message: string;
        pageData: Record<string, unknown>;
        component: string;
        locale: string;
        validation: {
            valid: boolean;
            errors: string[];
            warnings: string[];
            componentType: string;
            propsValidated: number;
        };
    };
}
export interface ScanComponentsResponse extends BaseResponse {
    data: {
        pagePath: string;
        components: Array<{
            path: string;
            resourceType: string;
            properties: Record<string, unknown>;
        }>;
        totalComponents: number;
    };
}
export interface BulkUpdateResponse extends BaseResponse {
    data: {
        success: boolean;
        message: string;
        results: Array<{
            componentPath: string;
            success: boolean;
            result?: unknown;
            error?: string;
            phase: string;
        }>;
        totalUpdates: number;
        successfulUpdates: number;
        failedUpdates: number;
    };
}
export interface AssetResponse extends BaseResponse {
    data: {
        success: boolean;
        assetPath: string;
        fileName: string;
        mimeType?: string;
        metadata?: Record<string, unknown>;
        uploadResponse?: unknown;
        assetData?: Record<string, unknown>;
        timestamp: string;
    };
}
export interface AssetMetadataResponse extends BaseResponse {
    data: {
        assetPath: string;
        metadata: Record<string, unknown>;
        fullData: Record<string, unknown>;
    };
}
export interface SearchResponse extends BaseResponse {
    data: {
        params: Record<string, unknown>;
        results: Array<Record<string, unknown>>;
        total: number;
        rawResponse?: Record<string, unknown>;
    };
}
export interface JCRQueryResponse {
    query: string;
    results: Array<Record<string, unknown>>;
    total: number;
    limit: number;
}
export interface TemplatesResponse extends BaseResponse {
    data: {
        sitePath: string;
        templates: Array<{
            name: string;
            path: string;
            title: string;
            description?: string;
            thumbnail?: string;
            allowedPaths?: string[];
            status?: string;
            ranking?: number;
            templateType?: string;
            lastModified?: string;
            createdBy?: string;
        }>;
        totalCount: number;
        source: string;
    };
}
export interface TemplateStructureResponse extends BaseResponse {
    data: {
        templatePath: string;
        structure: {
            path: string;
            properties: Record<string, unknown>;
            policies: Record<string, unknown>;
            structure: Record<string, unknown>;
            initialContent: Record<string, unknown>;
            allowedComponents: string[];
            allowedPaths: string[];
        };
        fullData: Record<string, unknown>;
    };
}
export interface SitesResponse extends BaseResponse {
    data: {
        sites: Array<{
            name: string;
            path: string;
            title: string;
            template?: string;
            lastModified?: string;
        }>;
        totalCount: number;
    };
}
export interface LanguageMastersResponse extends BaseResponse {
    data: {
        site: string;
        languageMasters: Array<{
            name: string;
            path: string;
            title: string;
            language: string;
        }>;
    };
}
export interface LocalesResponse extends BaseResponse {
    data: {
        site: string;
        languageMasterPath: string;
        availableLocales: Array<{
            name: string;
            title: string;
            language: string;
        }>;
    };
}
export interface ReplicateResponse extends BaseResponse {
    data: {
        message: string;
        selectedLocales: string[];
        componentData: unknown;
        localizedOverrides?: unknown;
    };
}
export interface ActivateResponse extends BaseResponse {
    data: {
        success: boolean;
        activatedPath: string;
        activateTree: boolean;
        response: unknown;
        fallbackUsed?: string;
        timestamp: string;
    };
}
export interface DeactivateResponse extends BaseResponse {
    data: {
        success: boolean;
        deactivatedPath: string;
        deactivateTree: boolean;
        response: unknown;
        fallbackUsed?: string;
        timestamp: string;
    };
}
export interface UnpublishResponse extends BaseResponse {
    data: {
        success: boolean;
        results: Array<{
            path: string;
            success: boolean;
            response?: unknown;
            error?: unknown;
        }>;
        unpublishedPaths: string[];
        unpublishTree: boolean;
        timestamp: string;
    };
}
export interface NodeContentResponse {
    path: string;
    depth: number;
    content: Record<string, unknown>;
    timestamp: string;
}
export interface ChildrenResponse {
    children: Array<{
        name: string;
        path: string;
        primaryType: string;
        title: string;
        lastModified?: string;
        resourceType?: string;
    }>;
}
export interface TextContentResponse extends BaseResponse {
    data: {
        pagePath: string;
        textContent: Array<{
            path: string;
            title?: string;
            text?: string;
            description?: string;
        }>;
    };
}
export interface ImagesResponse extends BaseResponse {
    data: {
        pagePath: string;
        images: Array<{
            path: string;
            fileReference?: string;
            src?: string;
            alt?: string;
            title?: string;
        }>;
    };
}
export interface IPageService {
    createPageWithValidation(request: CreatePageRequest): Promise<PageResponse>;
    deletePageWithConfirmation(request: DeletePageRequest): Promise<DeleteResponse>;
    listPagesWithFiltering(siteRoot: string, options: PageListOptions): Promise<ListPagesResponse>;
}
export interface PageListOptions {
    depth?: number;
    limit?: number;
    template?: string;
    lastModifiedAfter?: string;
    lastModifiedBefore?: string;
}
export interface IComponentService {
    validateComponentChanges(request: ValidateComponentRequest): Promise<ValidateResponse>;
    bulkUpdateWithRollback(request: BulkUpdateComponentsRequest): Promise<BulkUpdateResponse>;
}
export interface IAssetService {
    uploadWithValidation(request: UploadAssetRequest): Promise<AssetResponse>;
    updateWithMetadata(request: UpdateAssetRequest): Promise<AssetResponse>;
}
export interface ISearchService {
    searchWithFallback(params: SearchContentParams): Promise<SearchResponse>;
    executeWithValidation(query: string, limit?: number): Promise<JCRQueryResponse>;
}
export interface ITemplateService {
    getAvailableTemplates(parentPath: string): Promise<TemplatesResponse>;
    validateTemplateCompatibility(templatePath: string, targetPath: string): Promise<boolean>;
}
export interface IReplicationService {
    activateWithRetry(request: ActivatePageRequest): Promise<ActivateResponse>;
    deactivateWithRetry(request: DeactivatePageRequest): Promise<DeactivateResponse>;
}
export interface ICache {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    has(key: string): Promise<boolean>;
}
export interface IMetrics {
    incrementCounter(name: string, labels?: Record<string, string>): void;
    setGauge(name: string, value: number, labels?: Record<string, string>): void;
    recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
}
export interface IHealthChecker {
    checkHealth(): Promise<HealthStatus>;
    registerCheck(name: string, check: () => Promise<boolean>): void;
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, {
        status: 'healthy' | 'degraded' | 'unhealthy';
        message?: string;
        timestamp: string;
    }>;
    timestamp: string;
}
//# sourceMappingURL=index.d.ts.map
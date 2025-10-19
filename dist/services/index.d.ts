/**
 * Service Layer
 * Contains business logic and orchestrates operations between different modules
 */
import { IAEMConnector, ILogger } from '../interfaces/index.js';
import { CreatePageRequest, PageResponse, ListPagesResponse, PageListOptions, CreateComponentRequest, ComponentResponse, ValidateComponentRequest, ValidateResponse, BulkUpdateComponentsRequest, BulkUpdateResponse } from '../interfaces/index.js';
/**
 * Page Service - Handles page-related business logic
 */
export declare class PageService {
    private connector;
    private logger;
    constructor(connector: IAEMConnector, logger: ILogger);
    /**
     * Create a page with validation and error handling
     */
    createPageWithValidation(request: CreatePageRequest): Promise<PageResponse>;
    /**
     * List pages with filtering and pagination
     */
    listPagesWithFiltering(siteRoot: string, options: PageListOptions): Promise<ListPagesResponse>;
    /**
     * Delete page with confirmation and cleanup
     */
    deletePageWithConfirmation(request: {
        pagePath: string;
        force?: boolean;
    }): Promise<PageResponse>;
    /**
     * Validate create page request
     */
    private validateCreatePageRequest;
}
/**
 * Component Service - Handles component-related business logic
 */
export declare class ComponentService {
    private connector;
    private logger;
    constructor(connector: IAEMConnector, logger: ILogger);
    /**
     * Validate component changes with enhanced validation
     */
    validateComponentChanges(request: ValidateComponentRequest): Promise<ValidateResponse>;
    /**
     * Bulk update components with rollback support
     */
    bulkUpdateWithRollback(request: BulkUpdateComponentsRequest): Promise<BulkUpdateResponse>;
    /**
     * Create component with validation
     */
    createComponentWithValidation(request: CreateComponentRequest): Promise<ComponentResponse>;
    /**
     * Validate create component request
     */
    private validateCreateComponentRequest;
}
/**
 * Asset Service - Handles asset-related business logic
 */
export declare class AssetService {
    private connector;
    private logger;
    constructor(connector: IAEMConnector, logger: ILogger);
    /**
     * Upload asset with validation and metadata processing
     */
    uploadWithValidation(request: {
        parentPath: string;
        fileName: string;
        fileContent: string;
        mimeType?: string;
        metadata?: Record<string, unknown>;
    }): Promise<import("../interfaces/index.js").AssetResponse>;
    /**
     * Update asset with metadata validation
     */
    updateWithMetadata(request: {
        assetPath: string;
        metadata?: Record<string, unknown>;
        fileContent?: string;
        mimeType?: string;
    }): Promise<import("../interfaces/index.js").AssetResponse>;
    /**
     * Validate upload asset request
     */
    private validateUploadAssetRequest;
    /**
     * Validate update asset request
     */
    private validateUpdateAssetRequest;
    /**
     * Process and validate asset metadata
     */
    private processAssetMetadata;
}
/**
 * Search Service - Handles search-related business logic
 */
export declare class SearchService {
    private connector;
    private logger;
    constructor(connector: IAEMConnector, logger: ILogger);
    /**
     * Search with fallback strategies
     */
    searchWithFallback(params: {
        query: string;
        type?: string;
        path?: string;
        limit?: number;
    }): Promise<import("../interfaces/index.js").SearchResponse>;
    /**
     * Execute query with validation
     */
    executeWithValidation(query: string, limit?: number): Promise<import("../interfaces/index.js").JCRQueryResponse>;
    /**
     * Validate query for security
     */
    private validateQuery;
}
/**
 * Template Service - Handles template-related business logic
 */
export declare class TemplateService {
    private connector;
    private logger;
    constructor(connector: IAEMConnector, logger: ILogger);
    /**
     * Get available templates with caching
     */
    getAvailableTemplates(parentPath: string): Promise<import("../interfaces/index.js").TemplatesResponse>;
    /**
     * Validate template compatibility
     */
    validateTemplateCompatibility(templatePath: string, targetPath: string): Promise<boolean>;
}
/**
 * Replication Service - Handles replication-related business logic
 */
export declare class ReplicationService {
    private connector;
    private logger;
    constructor(connector: IAEMConnector, logger: ILogger);
    /**
     * Activate page with retry logic
     */
    activateWithRetry(request: {
        pagePath: string;
        activateTree?: boolean;
    }): Promise<import("../interfaces/index.js").ActivateResponse>;
    /**
     * Deactivate page with retry logic
     */
    deactivateWithRetry(request: {
        pagePath: string;
        deactivateTree?: boolean;
    }): Promise<import("../interfaces/index.js").DeactivateResponse>;
}
//# sourceMappingURL=index.d.ts.map
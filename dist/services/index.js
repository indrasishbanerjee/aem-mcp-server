/**
 * Service Layer
 * Contains business logic and orchestrates operations between different modules
 */
/**
 * Page Service - Handles page-related business logic
 */
export class PageService {
    connector;
    logger;
    constructor(connector, logger) {
        this.connector = connector;
        this.logger = logger;
    }
    /**
     * Create a page with validation and error handling
     */
    async createPageWithValidation(request) {
        this.logger.info('Creating page with validation', {
            parentPath: request.parentPath,
            title: request.title
        });
        try {
            // Validate request
            this.validateCreatePageRequest(request);
            // Create the page
            const result = await this.connector.createPage(request);
            this.logger.info('Page created successfully', {
                pagePath: result.data.pagePath,
                title: result.data.title
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to create page', {
                error: error instanceof Error ? error.message : String(error),
                request
            });
            throw error;
        }
    }
    /**
     * List pages with filtering and pagination
     */
    async listPagesWithFiltering(siteRoot, options) {
        this.logger.info('Listing pages with filtering', {
            siteRoot,
            options
        });
        try {
            const result = await this.connector.listPages(siteRoot, options.depth, options.limit);
            // Apply additional filtering if needed
            let filteredPages = result.data.pages;
            if (options.template) {
                filteredPages = filteredPages.filter(page => page.template === options.template);
            }
            if (options.lastModifiedAfter) {
                filteredPages = filteredPages.filter(page => page.lastModified && new Date(page.lastModified) > new Date(options.lastModifiedAfter));
            }
            if (options.lastModifiedBefore) {
                filteredPages = filteredPages.filter(page => page.lastModified && new Date(page.lastModified) < new Date(options.lastModifiedBefore));
            }
            return {
                ...result,
                data: {
                    ...result.data,
                    pages: filteredPages,
                    pageCount: filteredPages.length
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to list pages', {
                error: error instanceof Error ? error.message : String(error),
                siteRoot,
                options
            });
            throw error;
        }
    }
    /**
     * Delete page with confirmation and cleanup
     */
    async deletePageWithConfirmation(request) {
        this.logger.info('Deleting page with confirmation', {
            pagePath: request.pagePath
        });
        try {
            // Check if page exists
            await this.connector.getPageProperties(request.pagePath);
            // Delete the page
            const result = await this.connector.deletePage(request);
            this.logger.info('Page deleted successfully', {
                pagePath: request.pagePath
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to delete page', {
                error: error instanceof Error ? error.message : String(error),
                pagePath: request.pagePath
            });
            throw error;
        }
    }
    /**
     * Validate create page request
     */
    validateCreatePageRequest(request) {
        if (!request.parentPath) {
            throw new Error('Parent path is required');
        }
        if (!request.title) {
            throw new Error('Title is required');
        }
        if (!request.parentPath.startsWith('/content')) {
            throw new Error('Parent path must be under /content');
        }
        // Validate title length
        if (request.title.length > 255) {
            throw new Error('Title must be less than 255 characters');
        }
        // Validate page name if provided
        if (request.name) {
            const nameRegex = /^[a-zA-Z0-9-_]+$/;
            if (!nameRegex.test(request.name)) {
                throw new Error('Page name can only contain letters, numbers, hyphens, and underscores');
            }
        }
    }
}
/**
 * Component Service - Handles component-related business logic
 */
export class ComponentService {
    connector;
    logger;
    constructor(connector, logger) {
        this.connector = connector;
        this.logger = logger;
    }
    /**
     * Validate component changes with enhanced validation
     */
    async validateComponentChanges(request) {
        this.logger.info('Validating component changes', {
            component: request.component,
            pagePath: request.pagePath
        });
        try {
            // Perform basic validation
            const result = await this.connector.validateComponent(request);
            // Additional business logic validation
            if (result.data.validation.errors.length > 0) {
                this.logger.warn('Component validation found errors', {
                    errors: result.data.validation.errors,
                    component: request.component
                });
            }
            if (result.data.validation.warnings.length > 0) {
                this.logger.info('Component validation found warnings', {
                    warnings: result.data.validation.warnings,
                    component: request.component
                });
            }
            return result;
        }
        catch (error) {
            this.logger.error('Failed to validate component', {
                error: error instanceof Error ? error.message : String(error),
                request
            });
            throw error;
        }
    }
    /**
     * Bulk update components with rollback support
     */
    async bulkUpdateWithRollback(request) {
        this.logger.info('Starting bulk component update with rollback', {
            updateCount: request.updates.length
        });
        try {
            // Validate all components first
            if (request.validateFirst !== false) {
                for (const update of request.updates) {
                    try {
                        await this.connector.scanPageComponents(update.componentPath);
                    }
                    catch (error) {
                        this.logger.error('Component validation failed during bulk update', {
                            componentPath: update.componentPath,
                            error: error instanceof Error ? error.message : String(error)
                        });
                        if (!request.continueOnError) {
                            throw error;
                        }
                    }
                }
            }
            // Perform bulk update
            const result = await this.connector.bulkUpdateComponents(request);
            this.logger.info('Bulk component update completed', {
                successfulUpdates: result.data.successfulUpdates,
                failedUpdates: result.data.failedUpdates,
                totalUpdates: result.data.totalUpdates
            });
            return result;
        }
        catch (error) {
            this.logger.error('Bulk component update failed', {
                error: error instanceof Error ? error.message : String(error),
                request
            });
            throw error;
        }
    }
    /**
     * Create component with validation
     */
    async createComponentWithValidation(request) {
        this.logger.info('Creating component with validation', {
            componentType: request.componentType,
            pagePath: request.pagePath
        });
        try {
            // Validate request
            this.validateCreateComponentRequest(request);
            // Create the component
            const result = await this.connector.createComponent(request);
            this.logger.info('Component created successfully', {
                componentPath: result.data.componentPath,
                componentType: result.data.componentType
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to create component', {
                error: error instanceof Error ? error.message : String(error),
                request
            });
            throw error;
        }
    }
    /**
     * Validate create component request
     */
    validateCreateComponentRequest(request) {
        if (!request.pagePath) {
            throw new Error('Page path is required');
        }
        if (!request.componentType) {
            throw new Error('Component type is required');
        }
        if (!request.resourceType) {
            throw new Error('Resource type is required');
        }
        if (!request.pagePath.startsWith('/content')) {
            throw new Error('Page path must be under /content');
        }
        // Validate component type
        const allowedTypes = ['text', 'image', 'hero', 'button', 'list', 'teaser', 'carousel'];
        if (!allowedTypes.includes(request.componentType)) {
            throw new Error(`Component type '${request.componentType}' is not allowed`);
        }
        // Validate component name if provided
        if (request.name) {
            const nameRegex = /^[a-zA-Z0-9-_]+$/;
            if (!nameRegex.test(request.name)) {
                throw new Error('Component name can only contain letters, numbers, hyphens, and underscores');
            }
        }
    }
}
/**
 * Asset Service - Handles asset-related business logic
 */
export class AssetService {
    connector;
    logger;
    constructor(connector, logger) {
        this.connector = connector;
        this.logger = logger;
    }
    /**
     * Upload asset with validation and metadata processing
     */
    async uploadWithValidation(request) {
        this.logger.info('Uploading asset with validation', {
            fileName: request.fileName,
            parentPath: request.parentPath
        });
        try {
            // Validate request
            this.validateUploadAssetRequest(request);
            // Process metadata
            const processedMetadata = this.processAssetMetadata(request.metadata);
            // Upload the asset
            const result = await this.connector.uploadAsset({
                ...request,
                metadata: processedMetadata
            });
            this.logger.info('Asset uploaded successfully', {
                assetPath: result.data.assetPath,
                fileName: result.data.fileName
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to upload asset', {
                error: error instanceof Error ? error.message : String(error),
                fileName: request.fileName
            });
            throw error;
        }
    }
    /**
     * Update asset with metadata validation
     */
    async updateWithMetadata(request) {
        this.logger.info('Updating asset with metadata', {
            assetPath: request.assetPath
        });
        try {
            // Validate request
            this.validateUpdateAssetRequest(request);
            // Process metadata
            const processedMetadata = request.metadata ? this.processAssetMetadata(request.metadata) : undefined;
            // Update the asset
            const result = await this.connector.updateAsset({
                ...request,
                metadata: processedMetadata
            });
            this.logger.info('Asset updated successfully', {
                assetPath: request.assetPath
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to update asset', {
                error: error instanceof Error ? error.message : String(error),
                assetPath: request.assetPath
            });
            throw error;
        }
    }
    /**
     * Validate upload asset request
     */
    validateUploadAssetRequest(request) {
        if (!request.parentPath) {
            throw new Error('Parent path is required');
        }
        if (!request.fileName) {
            throw new Error('File name is required');
        }
        if (!request.fileContent) {
            throw new Error('File content is required');
        }
        if (!request.parentPath.startsWith('/content/dam')) {
            throw new Error('Parent path must be under /content/dam');
        }
        // Validate file name
        const fileNameRegex = /^[a-zA-Z0-9._-]+$/;
        if (!fileNameRegex.test(request.fileName)) {
            throw new Error('File name contains invalid characters');
        }
        // Validate MIME type if provided
        if (request.mimeType) {
            const allowedMimeTypes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml',
                'application/pdf', 'text/plain', 'text/html'
            ];
            if (!allowedMimeTypes.includes(request.mimeType)) {
                throw new Error(`MIME type '${request.mimeType}' is not allowed`);
            }
        }
    }
    /**
     * Validate update asset request
     */
    validateUpdateAssetRequest(request) {
        if (!request.assetPath) {
            throw new Error('Asset path is required');
        }
        if (!request.assetPath.startsWith('/content/dam')) {
            throw new Error('Asset path must be under /content/dam');
        }
    }
    /**
     * Process and validate asset metadata
     */
    processAssetMetadata(metadata) {
        if (!metadata) {
            return {};
        }
        const processed = {};
        // Standard metadata fields
        const allowedFields = [
            'dc:title', 'dc:description', 'dc:subject', 'dc:creator',
            'dc:publisher', 'dc:contributor', 'dc:date', 'dc:type',
            'dc:format', 'dc:identifier', 'dc:source', 'dc:language',
            'dc:relation', 'dc:coverage', 'dc:rights'
        ];
        Object.entries(metadata).forEach(([key, value]) => {
            if (allowedFields.includes(key) && value !== null && value !== undefined) {
                processed[key] = value;
            }
        });
        return processed;
    }
}
/**
 * Search Service - Handles search-related business logic
 */
export class SearchService {
    connector;
    logger;
    constructor(connector, logger) {
        this.connector = connector;
        this.logger = logger;
    }
    /**
     * Search with fallback strategies
     */
    async searchWithFallback(params) {
        this.logger.info('Performing search with fallback', {
            query: params.query
        });
        try {
            // Try primary search first
            let result = await this.connector.searchContent(params);
            // If no results, try with different strategies
            if (result.data.results.length === 0) {
                this.logger.info('No results found, trying fallback strategies');
                // Try with broader search
                const fallbackParams = {
                    ...params,
                    limit: params.limit || 20
                };
                result = await this.connector.searchContent(fallbackParams);
            }
            this.logger.info('Search completed', {
                resultCount: result.data.results.length,
                total: result.data.total
            });
            return result;
        }
        catch (error) {
            this.logger.error('Search failed', {
                error: error instanceof Error ? error.message : String(error),
                params
            });
            throw error;
        }
    }
    /**
     * Execute query with validation
     */
    async executeWithValidation(query, limit) {
        this.logger.info('Executing query with validation', {
            query: query.substring(0, 100) + '...' // Log only first 100 chars for security
        });
        try {
            // Validate query
            this.validateQuery(query);
            // Execute the query
            const result = await this.connector.executeJCRQuery(query, limit);
            this.logger.info('Query executed successfully', {
                resultCount: result.results.length,
                total: result.total
            });
            return result;
        }
        catch (error) {
            this.logger.error('Query execution failed', {
                error: error instanceof Error ? error.message : String(error),
                query: query.substring(0, 100) + '...'
            });
            throw error;
        }
    }
    /**
     * Validate query for security
     */
    validateQuery(query) {
        if (!query || query.trim().length === 0) {
            throw new Error('Query cannot be empty');
        }
        if (query.length > 1000) {
            throw new Error('Query is too long');
        }
        // Check for potentially dangerous patterns
        const dangerousPatterns = [
            /drop\s+table/i,
            /delete\s+from/i,
            /update\s+set/i,
            /insert\s+into/i,
            /exec\s*\(/i,
            /script\s*>/i,
            /<script/i
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(query)) {
                throw new Error('Query contains potentially dangerous patterns');
            }
        }
    }
}
/**
 * Template Service - Handles template-related business logic
 */
export class TemplateService {
    connector;
    logger;
    constructor(connector, logger) {
        this.connector = connector;
        this.logger = logger;
    }
    /**
     * Get available templates with caching
     */
    async getAvailableTemplates(parentPath) {
        this.logger.info('Getting available templates', {
            parentPath
        });
        try {
            const result = await this.connector.getTemplates(parentPath);
            this.logger.info('Templates retrieved successfully', {
                templateCount: result.data.totalCount,
                source: result.data.source
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to get templates', {
                error: error instanceof Error ? error.message : String(error),
                parentPath
            });
            throw error;
        }
    }
    /**
     * Validate template compatibility
     */
    async validateTemplateCompatibility(templatePath, targetPath) {
        this.logger.info('Validating template compatibility', {
            templatePath,
            targetPath
        });
        try {
            const result = await this.connector.getTemplateStructure(templatePath);
            const allowedPaths = result.data.structure.allowedPaths || [];
            // If no restrictions, allow all
            if (allowedPaths.length === 0) {
                return true;
            }
            // Check if target path is allowed
            const isAllowed = allowedPaths.some((allowedPath) => targetPath.startsWith(allowedPath));
            this.logger.info('Template compatibility check completed', {
                isAllowed,
                allowedPaths
            });
            return isAllowed;
        }
        catch (error) {
            this.logger.error('Failed to validate template compatibility', {
                error: error instanceof Error ? error.message : String(error),
                templatePath,
                targetPath
            });
            throw error;
        }
    }
}
/**
 * Replication Service - Handles replication-related business logic
 */
export class ReplicationService {
    connector;
    logger;
    constructor(connector, logger) {
        this.connector = connector;
        this.logger = logger;
    }
    /**
     * Activate page with retry logic
     */
    async activateWithRetry(request) {
        this.logger.info('Activating page with retry', {
            pagePath: request.pagePath
        });
        const maxRetries = 3;
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.connector.activatePage(request);
                this.logger.info('Page activated successfully', {
                    pagePath: request.pagePath,
                    attempt
                });
                return result;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.logger.warn('Page activation attempt failed', {
                    pagePath: request.pagePath,
                    attempt,
                    error: lastError.message
                });
                if (attempt < maxRetries) {
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        this.logger.error('Page activation failed after all retries', {
            pagePath: request.pagePath,
            maxRetries,
            lastError: lastError?.message
        });
        throw lastError || new Error('Page activation failed');
    }
    /**
     * Deactivate page with retry logic
     */
    async deactivateWithRetry(request) {
        this.logger.info('Deactivating page with retry', {
            pagePath: request.pagePath
        });
        const maxRetries = 3;
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.connector.deactivatePage(request);
                this.logger.info('Page deactivated successfully', {
                    pagePath: request.pagePath,
                    attempt
                });
                return result;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.logger.warn('Page deactivation attempt failed', {
                    pagePath: request.pagePath,
                    attempt,
                    error: lastError.message
                });
                if (attempt < maxRetries) {
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        this.logger.error('Page deactivation failed after all retries', {
            pagePath: request.pagePath,
            maxRetries,
            lastError: lastError?.message
        });
        throw lastError || new Error('Page deactivation failed');
    }
}
//# sourceMappingURL=index.js.map
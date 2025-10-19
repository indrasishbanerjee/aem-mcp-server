/**
 * Search Operations Module
 * Handles all AEM search-related operations including QueryBuilder, JCR queries, and enhanced search
 */
import { safeExecute, createSuccessResponse } from '../error-handler.js';
export class SearchOperations {
    httpClient;
    logger;
    config;
    constructor(httpClient, logger, config) {
        this.httpClient = httpClient;
        this.logger = logger;
        this.config = config;
    }
    /**
     * Search content using QueryBuilder
     */
    async searchContent(params) {
        return safeExecute(async () => {
            const response = await this.httpClient.get(this.config.endpoints.query, { params });
            return createSuccessResponse({
                params,
                results: response.data.hits || [],
                total: response.data.total || 0,
                rawResponse: response.data,
            }, 'searchContent');
        }, 'searchContent');
    }
    /**
     * Execute a QueryBuilder fulltext search for cq:Page nodes, with security validation
     * Note: This is NOT a true JCR SQL2 executor. It wraps QueryBuilder and only supports fulltext queries.
     */
    async executeJCRQuery(query, limit = 20) {
        return safeExecute(async () => {
            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                throw new Error('Query is required and must be a non-empty string. Note: Only QueryBuilder fulltext is supported, not JCR SQL2.');
            }
            // Basic security validation
            const lower = query.toLowerCase();
            if (/drop|delete|update|insert|exec|script|\.|<script/i.test(lower) || query.length > 1000) {
                throw new Error('Query contains potentially unsafe patterns or is too long');
            }
            const response = await this.httpClient.get('/bin/querybuilder.json', {
                params: {
                    path: '/content',
                    type: 'cq:Page',
                    fulltext: query,
                    'p.limit': limit
                }
            });
            return {
                query,
                results: response.data.hits || [],
                total: response.data.total || 0,
                limit
            };
        }, 'executeJCRQuery');
    }
    /**
     * Intelligent page search with comprehensive fallback strategies and cross-section search
     */
    async enhancedPageSearch(params) {
        return safeExecute(async () => {
            const { searchTerm, basePath, includeAlternateLocales } = params;
            // Try multiple search strategies
            const searchStrategies = [
                // Strategy 1: Direct fulltext search
                () => this.searchContent({
                    fulltext: searchTerm,
                    path: basePath,
                    type: 'cq:Page',
                    limit: 20
                }),
                // Strategy 2: Search by title
                () => this.searchContent({
                    'property': 'jcr:title',
                    'property.value': searchTerm,
                    'property.operation': 'like',
                    path: basePath,
                    type: 'cq:Page',
                    limit: 20
                }),
                // Strategy 3: Search by description
                () => this.searchContent({
                    'property': 'jcr:description',
                    'property.value': searchTerm,
                    'property.operation': 'like',
                    path: basePath,
                    type: 'cq:Page',
                    limit: 20
                })
            ];
            // If includeAlternateLocales is true, add locale-specific searches
            if (includeAlternateLocales) {
                searchStrategies.push(
                // Strategy 4: Search in all locales
                () => this.searchContent({
                    fulltext: searchTerm,
                    path: basePath.replace(/\/[a-z]{2}(-[A-Z]{2})?$/, ''),
                    type: 'cq:Page',
                    limit: 20
                }));
            }
            // Try each strategy until one succeeds
            let lastError;
            for (const strategy of searchStrategies) {
                try {
                    const result = await strategy();
                    if (result.data.results && result.data.results.length > 0) {
                        return createSuccessResponse({
                            params: {
                                searchTerm,
                                basePath,
                                includeAlternateLocales,
                                strategy: 'enhanced'
                            },
                            results: result.data.results,
                            total: result.data.total,
                            searchStrategies: searchStrategies.length
                        }, 'enhancedPageSearch');
                    }
                }
                catch (error) {
                    lastError = error;
                    this.logger.warn('Search strategy failed', {
                        error: error instanceof Error ? error.message : String(error),
                        searchTerm,
                        basePath
                    });
                }
            }
            // If all strategies failed, return empty results
            this.logger.warn('All search strategies failed', {
                searchTerm,
                basePath,
                lastError: lastError instanceof Error ? lastError.message : String(lastError)
            });
            return createSuccessResponse({
                params: {
                    searchTerm,
                    basePath,
                    includeAlternateLocales,
                    strategy: 'enhanced'
                },
                results: [],
                total: 0,
                searchStrategies: searchStrategies.length,
                allStrategiesFailed: true
            }, 'enhancedPageSearch');
        }, 'enhancedPageSearch');
    }
    /**
     * Search for content with advanced filtering options
     */
    async advancedSearch(params) {
        return safeExecute(async () => {
            const { query, contentType, path, properties, dateRange, limit = 20 } = params;
            const searchParams = {
                fulltext: query,
                'p.limit': limit
            };
            if (contentType) {
                searchParams.type = contentType;
            }
            if (path) {
                searchParams.path = path;
            }
            // Add property filters
            if (properties) {
                Object.entries(properties).forEach(([key, value], index) => {
                    searchParams[`property.${index}`] = key;
                    searchParams[`property.${index}.value`] = value;
                    searchParams[`property.${index}.operation`] = 'equals';
                });
            }
            // Add date range filter
            if (dateRange) {
                searchParams['daterange.property'] = dateRange.property;
                if (dateRange.from) {
                    searchParams['daterange.lowerBound'] = dateRange.from;
                }
                if (dateRange.to) {
                    searchParams['daterange.upperBound'] = dateRange.to;
                }
            }
            const response = await this.httpClient.get('/bin/querybuilder.json', {
                params: searchParams
            });
            return createSuccessResponse({
                params: {
                    query,
                    contentType,
                    path,
                    properties,
                    dateRange,
                    limit
                },
                results: response.data.hits || [],
                total: response.data.total || 0,
                rawResponse: response.data,
            }, 'advancedSearch');
        }, 'advancedSearch');
    }
    /**
     * Search for assets with specific criteria
     */
    async searchAssets(params) {
        return safeExecute(async () => {
            const { query, mimeType, path, tags, dateModified, limit = 20 } = params;
            const searchParams = {
                type: 'dam:Asset',
                'p.limit': limit
            };
            if (query) {
                searchParams.fulltext = query;
            }
            if (path) {
                searchParams.path = path;
            }
            else {
                searchParams.path = this.config.contentPaths.assetsRoot;
            }
            // Add MIME type filter
            if (mimeType) {
                searchParams['property'] = 'jcr:content/jcr:mimeType';
                searchParams['property.value'] = mimeType;
                searchParams['property.operation'] = 'equals';
            }
            // Add tag filters
            if (tags && tags.length > 0) {
                tags.forEach((tag, index) => {
                    searchParams[`tag.${index}`] = tag;
                });
            }
            // Add date modified filter
            if (dateModified) {
                searchParams['daterange.property'] = 'jcr:content/cq:lastModified';
                if (dateModified.from) {
                    searchParams['daterange.lowerBound'] = dateModified.from;
                }
                if (dateModified.to) {
                    searchParams['daterange.upperBound'] = dateModified.to;
                }
            }
            const response = await this.httpClient.get('/bin/querybuilder.json', {
                params: searchParams
            });
            return createSuccessResponse({
                params: {
                    query,
                    mimeType,
                    path,
                    tags,
                    dateModified,
                    limit
                },
                results: response.data.hits || [],
                total: response.data.total || 0,
                rawResponse: response.data,
            }, 'searchAssets');
        }, 'searchAssets');
    }
    /**
     * Get search suggestions based on a partial query
     */
    async getSearchSuggestions(partialQuery, maxSuggestions = 10) {
        return safeExecute(async () => {
            if (!partialQuery || partialQuery.length < 2) {
                return {
                    suggestions: [],
                    query: partialQuery,
                    timestamp: new Date().toISOString()
                };
            }
            // Search for pages that match the partial query
            const response = await this.searchContent({
                fulltext: partialQuery,
                path: '/content',
                type: 'cq:Page',
                limit: maxSuggestions
            });
            // Extract suggestions from page titles
            const suggestions = response.data.results
                .map((result) => result['jcr:content/jcr:title'] || result.title || result.name)
                .filter((title) => title && title.toLowerCase().includes(partialQuery.toLowerCase()))
                .slice(0, maxSuggestions);
            return {
                suggestions,
                query: partialQuery,
                timestamp: new Date().toISOString()
            };
        }, 'getSearchSuggestions');
    }
}
//# sourceMappingURL=search-operations.js.map
/**
 * Search Operations Module
 * Handles all AEM search-related operations including QueryBuilder, JCR queries, and enhanced search
 */
import { AxiosInstance } from 'axios';
import { IAEMConnector, SearchContentParams, EnhancedSearchParams, SearchResponse, JCRQueryResponse, ILogger, AEMConfig } from '../interfaces/index.js';
export declare class SearchOperations implements Partial<IAEMConnector> {
    private httpClient;
    private logger;
    private config;
    constructor(httpClient: AxiosInstance, logger: ILogger, config: AEMConfig);
    /**
     * Search content using QueryBuilder
     */
    searchContent(params: SearchContentParams): Promise<SearchResponse>;
    /**
     * Execute a QueryBuilder fulltext search for cq:Page nodes, with security validation
     * Note: This is NOT a true JCR SQL2 executor. It wraps QueryBuilder and only supports fulltext queries.
     */
    executeJCRQuery(query: string, limit?: number): Promise<JCRQueryResponse>;
    /**
     * Intelligent page search with comprehensive fallback strategies and cross-section search
     */
    enhancedPageSearch(params: EnhancedSearchParams): Promise<SearchResponse>;
    /**
     * Search for content with advanced filtering options
     */
    advancedSearch(params: {
        query: string;
        contentType?: string;
        path?: string;
        properties?: Record<string, string>;
        dateRange?: {
            property: string;
            from?: string;
            to?: string;
        };
        limit?: number;
    }): Promise<SearchResponse>;
    /**
     * Search for assets with specific criteria
     */
    searchAssets(params: {
        query?: string;
        mimeType?: string;
        path?: string;
        tags?: string[];
        dateModified?: {
            from?: string;
            to?: string;
        };
        limit?: number;
    }): Promise<SearchResponse>;
    /**
     * Get search suggestions based on a partial query
     */
    getSearchSuggestions(partialQuery: string, maxSuggestions?: number): Promise<{
        suggestions: string[];
        query: string;
        timestamp: string;
    }>;
}
//# sourceMappingURL=search-operations.d.ts.map
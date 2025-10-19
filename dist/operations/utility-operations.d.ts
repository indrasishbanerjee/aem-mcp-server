/**
 * Utility Operations Module
 * Handles utility operations like node content access, children listing, and content extraction
 */
import { AxiosInstance } from 'axios';
import { IAEMConnector, NodeContentResponse, ChildrenResponse, TextContentResponse, ImagesResponse, SitesResponse, LanguageMastersResponse, LocalesResponse, ILogger, AEMConfig } from '../interfaces/index.js';
export declare class UtilityOperations implements Partial<IAEMConnector> {
    private httpClient;
    private logger;
    private config;
    constructor(httpClient: AxiosInstance, logger: ILogger, config: AEMConfig);
    /**
     * Get JCR node content as raw JSON for a given path and depth
     */
    getNodeContent(path: string, depth?: number): Promise<NodeContentResponse>;
    /**
     * List direct children under a path using AEM's JSON API
     */
    listChildren(path: string): Promise<ChildrenResponse>;
    /**
     * Get all available sites in AEM
     */
    fetchSites(): Promise<SitesResponse>;
    /**
     * Get language masters for a specific site
     */
    fetchLanguageMasters(site: string): Promise<LanguageMastersResponse>;
    /**
     * Get available locales for a site and language master
     */
    fetchAvailableLocales(site: string, languageMasterPath: string): Promise<LocalesResponse>;
    /**
     * Get all text content from a page including titles, text components, and descriptions
     */
    getAllTextContent(pagePath: string): Promise<TextContentResponse>;
    /**
     * Get text content from a specific page (alias for getAllTextContent)
     */
    getPageTextContent(pagePath: string): Promise<TextContentResponse>;
    /**
     * Get all images from a page, including those within Experience Fragments
     */
    getPageImages(pagePath: string): Promise<ImagesResponse>;
    /**
     * Get page content including Experience Fragments and Content Fragments
     */
    getPageContent(pagePath: string): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            pagePath: string;
            content: Record<string, unknown>;
        };
    }>;
    /**
     * Update the image path for an image component and verify the update
     */
    updateImagePath(componentPath: string, newImagePath: string): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
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
    }>;
    /**
     * Undo changes (placeholder implementation)
     * Note: AEM MCP does not support undo/rollback. Use AEM version history.
     */
    undoChanges(request: {
        jobId: string;
    }): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            message: string;
            request: {
                jobId: string;
            };
            timestamp: string;
        };
    }>;
}
//# sourceMappingURL=utility-operations.d.ts.map
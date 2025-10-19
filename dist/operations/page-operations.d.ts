/**
 * Page Operations Module
 * Handles all AEM page-related operations including CRUD, activation, and content extraction
 */
import { AxiosInstance } from 'axios';
import { CreatePageRequest, DeletePageRequest, ActivatePageRequest, DeactivatePageRequest, PageResponse, DeleteResponse, ListPagesResponse, PageContentResponse, PagePropertiesResponse, ActivateResponse, DeactivateResponse, TextContentResponse, ImagesResponse, ILogger, AEMConfig } from '../interfaces/index.js';
export declare class PageOperations {
    private httpClient;
    private logger;
    private config;
    constructor(httpClient: AxiosInstance, logger: ILogger, config: AEMConfig);
    /**
     * Create a new page in AEM with proper template handling
     */
    createPage(request: CreatePageRequest): Promise<PageResponse>;
    /**
     * Delete a page from AEM
     */
    deletePage(request: DeletePageRequest): Promise<DeleteResponse>;
    /**
     * List all cq:Page nodes under a site root
     */
    listPages(siteRoot: string, depth?: number, limit?: number): Promise<ListPagesResponse>;
    /**
     * Get complete page content including Experience Fragments and Content Fragments
     */
    getPageContent(pagePath: string): Promise<PageContentResponse>;
    /**
     * Get page properties and metadata
     */
    getPageProperties(pagePath: string): Promise<PagePropertiesResponse>;
    /**
     * Activate (publish) a single page
     */
    activatePage(request: ActivatePageRequest): Promise<ActivateResponse>;
    /**
     * Deactivate (unpublish) a single page
     */
    deactivatePage(request: DeactivatePageRequest): Promise<DeactivateResponse>;
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
     * Helper method to get available templates for a parent path
     */
    private getTemplates;
}
//# sourceMappingURL=page-operations.d.ts.map
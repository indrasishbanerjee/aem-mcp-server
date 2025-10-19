/**
 * Template Operations Module
 * Handles all AEM template-related operations including discovery, structure analysis, and validation
 */
import { AxiosInstance } from 'axios';
import { IAEMConnector, TemplatesResponse, TemplateStructureResponse, ILogger, AEMConfig } from '../interfaces/index.js';
export declare class TemplateOperations implements Partial<IAEMConnector> {
    private httpClient;
    private logger;
    private config;
    private templateCache;
    private templateCacheExpiry;
    private readonly TEMPLATE_CACHE_TTL;
    constructor(httpClient: AxiosInstance, logger: ILogger, config: AEMConfig);
    /**
     * Get available page templates for a site
     */
    getTemplates(sitePath?: string): Promise<TemplatesResponse>;
    /**
     * Get detailed structure of a specific template
     */
    getTemplateStructure(templatePath: string): Promise<TemplateStructureResponse>;
    /**
     * Get available templates for a parent path with enhanced discovery
     */
    getAvailableTemplates(parentPath: string): Promise<TemplatesResponse>;
    /**
     * Validate template compatibility with target path
     */
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
    /**
     * Get template metadata with caching
     */
    getTemplateMetadata(templatePath: string, useCache?: boolean): Promise<any>;
    /**
     * Clear template cache
     */
    clearTemplateCache(): void;
}
//# sourceMappingURL=template-operations.d.ts.map
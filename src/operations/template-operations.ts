/**
 * Template Operations Module
 * Handles all AEM template-related operations including discovery, structure analysis, and validation
 */

import { AxiosInstance } from 'axios';
import { 
  IAEMConnector,
  TemplatesResponse,
  TemplateStructureResponse,
  ILogger,
  AEMConfig
} from '../interfaces/index.js';
import { 
  AEMOperationError,
  createAEMError,
  handleAEMHttpError,
  safeExecute,
  createSuccessResponse,
  AEM_ERROR_CODES
} from '../error-handler.js';

export class TemplateOperations implements Partial<IAEMConnector> {
  private templateCache = new Map<string, any>();
  private templateCacheExpiry = new Map<string, number>();
  private readonly TEMPLATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private httpClient: AxiosInstance,
    private logger: ILogger,
    private config: AEMConfig
  ) {}

  /**
   * Get available page templates for a site
   */
  async getTemplates(sitePath?: string): Promise<TemplatesResponse> {
    return safeExecute<TemplatesResponse>(async () => {
      // If sitePath is provided, look for templates specific to that site
      if (sitePath) {
        try {
          // Try to get site-specific templates from /conf
          const confPath = `/conf${sitePath.replace('/content', '')}/settings/wcm/templates`;
          const response = await this.httpClient.get(`${confPath}.json`, {
            params: { ':depth': '2' }
          });
          
          const templates: Array<{
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
          }> = [];

          if (response.data && typeof response.data === 'object') {
            Object.entries(response.data).forEach(([key, value]: [string, any]) => {
              if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
              if (value && typeof value === 'object' && value['jcr:content']) {
                templates.push({
                  name: key,
                  path: `${confPath}/${key}`,
                  title: value['jcr:content']['jcr:title'] || key,
                  description: value['jcr:content']['jcr:description'],
                  thumbnail: value['jcr:content']['thumbnail'],
                  allowedPaths: value['jcr:content']['allowedPaths'],
                  status: value['jcr:content']['status'],
                  ranking: value['jcr:content']['ranking'] || 0,
                  templateType: value['jcr:content']['templateType'],
                  lastModified: value['jcr:content']['cq:lastModified'],
                  createdBy: value['jcr:content']['jcr:createdBy']
                });
              }
            });
          }
          
          return createSuccessResponse({
            sitePath,
            templates,
            totalCount: templates.length,
            source: 'site-specific'
          }, 'getTemplates') as TemplatesResponse;
        } catch (error: any) {
          // Fallback to global templates if site-specific not found
          this.logger.warn('Site-specific templates not found, falling back to global templates', {
            sitePath,
            error: error.message
          });
        }
      }
      
      // Get global templates from /apps or /libs
      try {
        const globalPaths = ['/apps/wcm/core/content/sites/templates', '/libs/wcm/core/content/sites/templates'];
        const allTemplates: Array<{
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
          source?: string;
        }> = [];
        
        for (const templatePath of globalPaths) {
          try {
            const response = await this.httpClient.get(`${templatePath}.json`, {
              params: { ':depth': '2' }
            });
            
            if (response.data && typeof response.data === 'object') {
              Object.entries(response.data).forEach(([key, value]: [string, any]) => {
                if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
                if (value && typeof value === 'object') {
                  allTemplates.push({
                    name: key,
                    path: `${templatePath}/${key}`,
                    title: value['jcr:title'] || key,
                    description: value['jcr:description'],
                    thumbnail: value['thumbnail'],
                    allowedPaths: value['allowedPaths'],
                    status: value['status'] || 'enabled',
                    ranking: value['ranking'] || 0,
                    templateType: value['templateType'],
                    lastModified: value['cq:lastModified'],
                    createdBy: value['jcr:createdBy'],
                    source: templatePath.includes('/apps/') ? 'apps' : 'libs'
                  });
                }
              });
            }
          } catch (pathError: any) {
            // Continue to next path if this one fails
            this.logger.debug('Template path not accessible', {
              path: templatePath,
              error: pathError.message
            });
          }
        }
        
        return createSuccessResponse({
          sitePath: sitePath || 'global',
          templates: allTemplates,
          totalCount: allTemplates.length,
          source: 'global'
        }, 'getTemplates') as TemplatesResponse;
      } catch (error: any) {
        throw handleAEMHttpError(error, 'getTemplates');
      }
    }, 'getTemplates');
  }

  /**
   * Get detailed structure of a specific template
   */
  async getTemplateStructure(templatePath: string): Promise<TemplateStructureResponse> {
    return safeExecute<TemplateStructureResponse>(async () => {
      try {
        // Get the full template structure with deeper depth
        const response = await this.httpClient.get(`${templatePath}.infinity.json`);
        
        const structure = {
          path: templatePath,
          properties: response.data['jcr:content'] || {},
          policies: response.data['jcr:content']?.['policies'] || {},
          structure: response.data['jcr:content']?.['structure'] || {},
          initialContent: response.data['jcr:content']?.['initial'] || {},
          allowedComponents: [] as string[],
          allowedPaths: response.data['jcr:content']?.['allowedPaths'] || []
        };
        
        // Extract allowed components from policies
        const extractComponents = (node: any, path: string = '') => {
          if (!node || typeof node !== 'object') return;
          
          if (node['components']) {
            const componentKeys = Object.keys(node['components']);
            structure.allowedComponents.push(...componentKeys);
          }
          
          Object.entries(node).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null && !key.startsWith('jcr:')) {
              extractComponents(value, path ? `${path}/${key}` : key);
            }
          });
        };
        
        extractComponents(structure.policies);
        
        // Remove duplicates
        structure.allowedComponents = [...new Set(structure.allowedComponents)];
        
        return createSuccessResponse({
          templatePath,
          structure,
          fullData: response.data
        }, 'getTemplateStructure') as TemplateStructureResponse;
      } catch (error: any) {
        throw handleAEMHttpError(error, 'getTemplateStructure');
      }
    }, 'getTemplateStructure');
  }

  /**
   * Get available templates for a parent path with enhanced discovery
   */
  async getAvailableTemplates(parentPath: string): Promise<TemplatesResponse> {
    return safeExecute<TemplatesResponse>(async () => {
      // Try to determine site configuration from parent path
      let confPath = '/conf';
      const pathParts = parentPath.split('/');
      if (pathParts.length >= 3 && pathParts[1] === 'content') {
        const siteName = pathParts[2];
        confPath = `/conf/${siteName}`;
      }
      
      // Get templates from configuration
      const templatesPath = `${confPath}/settings/wcm/templates`;
      
      try {
        const response = await this.httpClient.get(`${templatesPath}.json`, {
          params: { ':depth': '3' }
        });
        
        const templates: Array<{
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
        }> = [];
        
        if (response.data && typeof response.data === 'object') {
          Object.entries(response.data).forEach(([key, value]: [string, any]) => {
            if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
            
            if (value && typeof value === 'object' && value['jcr:content']) {
              const templatePath = `${templatesPath}/${key}`;
              const content = value['jcr:content'];
              
              templates.push({
                name: key,
                path: templatePath,
                title: content['jcr:title'] || key,
                description: content['jcr:description'] || '',
                thumbnail: content['thumbnail'] || '',
                allowedPaths: content['allowedPaths'] || [],
                status: content['status'] || 'enabled',
                ranking: content['ranking'] || 0,
                templateType: content['templateType'] || 'page',
                lastModified: content['cq:lastModified'],
                createdBy: content['jcr:createdBy']
              });
            }
          });
        }
        
        // Sort templates by ranking and name
        templates.sort((a, b) => {
          if (a.ranking !== b.ranking) {
            return (b.ranking ?? 0) - (a.ranking ?? 0); // Higher ranking first
          }
          return a.name.localeCompare(b.name);
        });
        
        return createSuccessResponse({
          sitePath: parentPath,
          source: 'templates',
          templates,
          totalCount: templates.length,
          availableTemplates: templates.filter(t => t.status === 'enabled')
        }, 'getAvailableTemplates') as TemplatesResponse;
        
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Fallback to global templates
          const globalTemplatesPath = '/libs/wcm/foundation/templates';
          const globalResponse = await this.httpClient.get(`${globalTemplatesPath}.json`, {
            params: { ':depth': '2' }
          });
          
          const globalTemplates: Array<{
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
            isGlobal?: boolean;
          }> = [];

          if (globalResponse.data && typeof globalResponse.data === 'object') {
            Object.entries(globalResponse.data).forEach(([key, value]: [string, any]) => {
              if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
              
              if (value && typeof value === 'object') {
                globalTemplates.push({
                  name: key,
                  path: `${globalTemplatesPath}/${key}`,
                  title: value['jcr:title'] || key,
                  description: value['jcr:description'] || 'Global template',
                  thumbnail: value['thumbnail'] || '',
                  allowedPaths: value['allowedPaths'] || [],
                  status: 'enabled',
                  ranking: 0,
                  templateType: 'page',
                  lastModified: value['cq:lastModified'],
                  createdBy: value['jcr:createdBy'],
                  isGlobal: true
                });
              }
            });
          }
          
          return createSuccessResponse({
            sitePath: parentPath,
            source: 'global-templates',
            templates: globalTemplates,
            totalCount: globalTemplates.length,
            availableTemplates: globalTemplates,
            fallbackUsed: true
          }, 'getAvailableTemplates') as TemplatesResponse;
        }
        throw error;
      }
    }, 'getAvailableTemplates');
  }

  /**
   * Validate template compatibility with target path
   */
  async validateTemplate(templatePath: string, targetPath: string): Promise<{
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
  }> {
    return safeExecute(async () => {
      try {
        const response = await this.httpClient.get(`${templatePath}.json`);
        const templateData = response.data;
        
        if (!templateData || !templateData['jcr:content']) {
          throw createAEMError(
            AEM_ERROR_CODES.INVALID_PARAMETERS, 
            'Invalid template structure', 
            { templatePath }
          );
        }

        const content = templateData['jcr:content'];
        const allowedPaths = content['allowedPaths'] || [];
        
        // Check if target path is allowed
        let isAllowed = allowedPaths.length === 0; // If no restrictions, allow all
        
        if (allowedPaths.length > 0) {
          isAllowed = allowedPaths.some((allowedPath: string) => {
            return targetPath.startsWith(allowedPath);
          });
        }

        return {
          templatePath,
          targetPath,
          isValid: isAllowed,
          templateTitle: content['jcr:title'] || 'Untitled Template',
          templateDescription: content['jcr:description'] || '',
          allowedPaths,
          restrictions: {
            hasPathRestrictions: allowedPaths.length > 0,
            allowedPaths
          }
        };
        
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw createAEMError(
            AEM_ERROR_CODES.INVALID_PARAMETERS, 
            `Template not found: ${templatePath}`, 
            { templatePath }
          );
        }
        throw handleAEMHttpError(error, 'validateTemplate');
      }
    }, 'validateTemplate');
  }

  /**
   * Get template metadata with caching
   */
  async getTemplateMetadata(templatePath: string, useCache = true): Promise<any> {
    return safeExecute(async () => {
      // Check cache first
      if (useCache && this.templateCache.has(templatePath)) {
        const expiry = this.templateCacheExpiry.get(templatePath) || 0;
        if (Date.now() < expiry) {
          return {
            ...this.templateCache.get(templatePath),
            fromCache: true
          };
        }
      }

      const response = await this.httpClient.get(`${templatePath}.json`);
      
      if (!response.data || !response.data['jcr:content']) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          'Invalid template structure', 
          { templatePath }
        );
      }

      const content = response.data['jcr:content'];
      const metadata = {
        templatePath,
        title: content['jcr:title'] || 'Untitled Template',
        description: content['jcr:description'] || '',
        thumbnail: content['thumbnail'] || '',
        allowedPaths: content['allowedPaths'] || [],
        status: content['status'] || 'enabled',
        ranking: content['ranking'] || 0,
        templateType: content['templateType'] || 'page',
        lastModified: content['cq:lastModified'],
        createdBy: content['jcr:createdBy'],
        policies: content['policies'] || {},
        structure: content['structure'] || {},
        initialContent: content['initial'] || {}
      };

      // Cache the result
      if (useCache) {
        this.templateCache.set(templatePath, metadata);
        this.templateCacheExpiry.set(templatePath, Date.now() + this.TEMPLATE_CACHE_TTL);
      }

      return metadata;
    }, 'getTemplateMetadata');
  }

  /**
   * Clear template cache
   */
  clearTemplateCache(): void {
    this.templateCache.clear();
    this.templateCacheExpiry.clear();
    this.logger.info('Template cache cleared');
  }
}

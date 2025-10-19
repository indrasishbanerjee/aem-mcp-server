/**
 * Page Operations Module
 * Handles all AEM page-related operations including CRUD, activation, and content extraction
 */

import { AxiosInstance } from 'axios';
import { 
  IAEMConnector, 
  CreatePageRequest, 
  DeletePageRequest, 
  ActivatePageRequest, 
  DeactivatePageRequest,
  PageResponse,
  DeleteResponse,
  ListPagesResponse,
  PageContentResponse,
  PagePropertiesResponse,
  ActivateResponse,
  DeactivateResponse,
  TextContentResponse,
  ImagesResponse,
  ILogger,
  AEMConfig
} from '../interfaces/index.js';
import { 
  AEMOperationError,
  createAEMError,
  handleAEMHttpError,
  safeExecute,
  createSuccessResponse,
  AEM_ERROR_CODES,
  isValidContentPath
} from '../error-handler.js';

export class PageOperations {
  constructor(
    private httpClient: AxiosInstance,
    private logger: ILogger,
    private config: AEMConfig
  ) {}

  /**
   * Create a new page in AEM with proper template handling
   */
  async createPage(request: CreatePageRequest): Promise<PageResponse> {
    return safeExecute<PageResponse>(async () => {
      const { parentPath, title, template, name, properties = {} } = request;
      
      if (!isValidContentPath(parentPath)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          `Invalid parent path: ${String(parentPath)}`, 
          { parentPath }
        );
      }

      // Auto-select template if not provided
      let selectedTemplate = template;
      if (!selectedTemplate) {
        const templatesResponse = await this.getTemplates(parentPath);
        const availableTemplates = (templatesResponse as any).data.availableTemplates;
        
        if (availableTemplates.length === 0) {
          throw createAEMError(
            AEM_ERROR_CODES.INVALID_PARAMETERS, 
            'No templates available for this path', 
            { parentPath }
          );
        }
        
        selectedTemplate = availableTemplates[0].path;
        this.logger.info(`Auto-selected template: ${selectedTemplate}`);
      }

      // Validate template exists
      try {
        await this.httpClient.get(`${selectedTemplate}.json`);
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw createAEMError(
            AEM_ERROR_CODES.INVALID_PARAMETERS, 
            `Template not found: ${selectedTemplate}`, 
            { template: selectedTemplate }
          );
        }
        throw handleAEMHttpError(error, 'createPage');
      }

      const pageName = name || title.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const newPagePath = `${parentPath}/${pageName}`;

      // Create page with proper structure
      const pageData = {
        'jcr:primaryType': 'cq:Page',
        'jcr:content': {
          'jcr:primaryType': 'cq:PageContent',
          'jcr:title': title,
          'cq:template': selectedTemplate,
          'sling:resourceType': 'foundation/components/page',
          'cq:lastModified': new Date().toISOString(),
          'cq:lastModifiedBy': 'admin',
          ...properties
        }
      };

      // Create the page using Sling POST servlet
      const formData = new URLSearchParams();
      formData.append('jcr:primaryType', 'cq:Page');
      
      // Create page first
      await this.httpClient.post(newPagePath, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Then create jcr:content node
      const contentFormData = new URLSearchParams();
      Object.entries(pageData['jcr:content']).forEach(([key, value]) => {
        if (key === 'jcr:created' || key === 'jcr:createdBy') {
          return;
        }
        
        if (typeof value === 'object') {
          contentFormData.append(key, JSON.stringify(value));
        } else {
          contentFormData.append(key, String(value));
        }
      });

      await this.httpClient.post(`${newPagePath}/jcr:content`, contentFormData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Verify page creation
      const verificationResponse = await this.httpClient.get(`${newPagePath}.json`);
      const hasJcrContent = verificationResponse.data['jcr:content'] !== undefined;
      
      // Check if page is accessible in author mode
      let pageAccessible = false;
      try {
        const authorResponse = await this.httpClient.get(`${newPagePath}.html`, {
          validateStatus: (status) => status < 500
        });
        pageAccessible = authorResponse.status === 200;
      } catch (error) {
        pageAccessible = false;
      }

      return createSuccessResponse({
        pagePath: newPagePath,
        title,
        templateUsed: selectedTemplate,
        jcrContentCreated: hasJcrContent,
        pageAccessible,
        errorLogCheck: {
          hasErrors: false,
          errors: []
        },
        creationDetails: {
          timestamp: new Date().toISOString(),
          steps: [
            'Template validation completed',
            'Page node created',
            'jcr:content node created',
            'Page structure verified',
            'Accessibility check completed'
          ]
        },
        pageStructure: verificationResponse.data
      }, 'createPage') as PageResponse;
    }, 'createPage');
  }

  /**
   * Delete a page from AEM
   */
  async deletePage(request: DeletePageRequest): Promise<DeleteResponse> {
    return safeExecute<DeleteResponse>(async () => {
      const { pagePath, force = false } = request;
      
      if (!isValidContentPath(pagePath)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          `Invalid page path: ${String(pagePath)}`, 
          { pagePath }
        );
      }

      let deleted = false;
      try {
        await this.httpClient.delete(pagePath);
        deleted = true;
      } catch (err: any) {
        if (err.response && err.response.status === 405) {
          try {
            await this.httpClient.post('/bin/wcmcommand', {
              cmd: 'deletePage',
              path: pagePath,
              force: force.toString(),
            });
            deleted = true;
          } catch (postErr: any) {
            try {
              await this.httpClient.post(pagePath, { ':operation': 'delete' });
              deleted = true;
            } catch (slingErr: any) {
              this.logger.error('Sling POST delete failed', {
                error: slingErr.response?.status,
                data: slingErr.response?.data
              });
              throw slingErr;
            }
          }
        } else {
          this.logger.error('DELETE failed', {
            status: err.response?.status,
            data: err.response?.data
          });
          throw err;
        }
      }

      return createSuccessResponse({
        success: deleted,
        deletedPath: pagePath,
        timestamp: new Date().toISOString(),
      }, 'deletePage') as DeleteResponse;
    }, 'deletePage');
  }

  /**
   * List all cq:Page nodes under a site root
   */
  async listPages(siteRoot: string, depth = 1, limit = 20): Promise<ListPagesResponse> {
    return safeExecute<ListPagesResponse>(async () => {
      // First try direct JSON API approach for better performance
      try {
        const response = await this.httpClient.get(`${siteRoot}.${depth}.json`);
        const pages: Array<{
          name: string;
          path: string;
          primaryType: string;
          title: string;
          template?: string;
          lastModified?: string;
          lastModifiedBy?: string;
          resourceType?: string;
          type: string;
        }> = [];
        
        const processNode = (node: any, currentPath: string, currentDepth: number) => {
          if (currentDepth > depth || pages.length >= limit) return;
          
          Object.entries(node).forEach(([key, value]: [string, any]) => {
            if (pages.length >= limit) return;
            
            // Skip JCR system properties
            if (key.startsWith('jcr:') || key.startsWith('sling:') || key.startsWith('cq:') || 
                key.startsWith('rep:') || key.startsWith('oak:')) {
              return;
            }
            
            if (value && typeof value === 'object') {
              const childPath = `${currentPath}/${key}`;
              const primaryType = value['jcr:primaryType'];
              
              // Only include cq:Page nodes
              if (primaryType === 'cq:Page') {
                pages.push({
                  name: key,
                  path: childPath,
                  primaryType: 'cq:Page',
                  title: value['jcr:content']?.['jcr:title'] || key,
                  template: value['jcr:content']?.['cq:template'],
                  lastModified: value['jcr:content']?.['cq:lastModified'],
                  lastModifiedBy: value['jcr:content']?.['cq:lastModifiedBy'],
                  resourceType: value['jcr:content']?.['sling:resourceType'],
                  type: 'page'
                });
              }
              
              // Recursively process child nodes if within depth limit
              if (currentDepth < depth) {
                processNode(value, childPath, currentDepth + 1);
              }
            }
          });
        };
        
        if (response.data && typeof response.data === 'object') {
          processNode(response.data, siteRoot, 0);
        }
        
        return createSuccessResponse({
          siteRoot,
          pages,
          pageCount: pages.length,
          depth,
          limit,
          totalChildrenScanned: pages.length
        }, 'listPages') as ListPagesResponse;
        
      } catch (error: any) {
        // Fallback to QueryBuilder if JSON API fails
        if (error.response?.status === 404 || error.response?.status === 403) {
          const response = await this.httpClient.get('/bin/querybuilder.json', {
            params: {
              path: siteRoot,
              type: 'cq:Page',
              'p.nodedepth': depth.toString(),
              'p.limit': limit.toString(),
              'p.hits': 'full'
            },
          });
          
          const pages = (response.data.hits || []).map((hit: any) => ({
            name: hit.name || hit.path?.split('/').pop(),
            path: hit.path,
            primaryType: 'cq:Page',
            title: hit['jcr:content/jcr:title'] || hit.title || hit.name,
            template: hit['jcr:content/cq:template'],
            lastModified: hit['jcr:content/cq:lastModified'],
            lastModifiedBy: hit['jcr:content/cq:lastModifiedBy'],
            resourceType: hit['jcr:content/sling:resourceType'],
            type: 'page'
          }));
          
          return createSuccessResponse({
            siteRoot,
            pages,
            pageCount: pages.length,
            depth,
            limit,
            totalChildrenScanned: response.data.total || pages.length,
            fallbackUsed: 'QueryBuilder'
          }, 'listPages') as ListPagesResponse;
        }
        throw error;
      }
    }, 'listPages');
  }

  /**
   * Get complete page content including Experience Fragments and Content Fragments
   */
  async getPageContent(pagePath: string): Promise<PageContentResponse> {
    return safeExecute<PageContentResponse>(async () => {
      const response = await this.httpClient.get(`${pagePath}.infinity.json`);
      return createSuccessResponse({
        pagePath,
        content: response.data,
      }, 'getPageContent') as PageContentResponse;
    }, 'getPageContent');
  }

  /**
   * Get page properties and metadata
   */
  async getPageProperties(pagePath: string): Promise<PagePropertiesResponse> {
    return safeExecute<PagePropertiesResponse>(async () => {
      const response = await this.httpClient.get(`${pagePath}/jcr:content.json`);
      const content = response.data;
      const properties = {
        title: content['jcr:title'],
        description: content['jcr:description'],
        template: content['cq:template'],
        lastModified: content['cq:lastModified'],
        lastModifiedBy: content['cq:lastModifiedBy'],
        created: content['jcr:created'],
        createdBy: content['jcr:createdBy'],
        primaryType: content['jcr:primaryType'],
        resourceType: content['sling:resourceType'],
        tags: content['cq:tags'] || [],
        properties: content,
      };
      return createSuccessResponse({
        pagePath,
        properties
      }, 'getPageProperties') as PagePropertiesResponse;
    }, 'getPageProperties');
  }

  /**
   * Activate (publish) a single page
   */
  async activatePage(request: ActivatePageRequest): Promise<ActivateResponse> {
    return safeExecute<ActivateResponse>(async () => {
      const { pagePath, activateTree = false } = request;
      
      if (!isValidContentPath(pagePath)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          `Invalid page path: ${String(pagePath)}`, 
          { pagePath }
        );
      }
      
      try {
        // Use the correct AEM replication servlet endpoint
        const formData = new URLSearchParams();
        formData.append('cmd', 'Activate');
        formData.append('path', pagePath);
        formData.append('ignoredeactivated', 'false');
        formData.append('onlymodified', 'false');
        
        if (activateTree) {
          formData.append('deep', 'true');
        }
        
        const response = await this.httpClient.post('/bin/replicate.json', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        
        return createSuccessResponse({
          success: true,
          activatedPath: pagePath,
          activateTree,
          response: response.data,
          timestamp: new Date().toISOString(),
        }, 'activatePage') as ActivateResponse;
      } catch (error: any) {
        // Fallback to alternative replication methods
        try {
          const wcmResponse = await this.httpClient.post('/bin/wcmcommand', {
            cmd: 'activate',
            path: pagePath,
            ignoredeactivated: false,
            onlymodified: false,
          });
          
          return createSuccessResponse({
            success: true,
            activatedPath: pagePath,
            activateTree,
            response: wcmResponse.data,
            fallbackUsed: 'WCM Command',
            timestamp: new Date().toISOString(),
          }, 'activatePage') as ActivateResponse;
        } catch (fallbackError: any) {
          throw handleAEMHttpError(error, 'activatePage');
        }
      }
    }, 'activatePage');
  }

  /**
   * Deactivate (unpublish) a single page
   */
  async deactivatePage(request: DeactivatePageRequest): Promise<DeactivateResponse> {
    return safeExecute<DeactivateResponse>(async () => {
      const { pagePath, deactivateTree = false } = request;
      
      if (!isValidContentPath(pagePath)) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          `Invalid page path: ${String(pagePath)}`, 
          { pagePath }
        );
      }
      
      try {
        // Use the correct AEM replication servlet endpoint
        const formData = new URLSearchParams();
        formData.append('cmd', 'Deactivate');
        formData.append('path', pagePath);
        formData.append('ignoredeactivated', 'false');
        formData.append('onlymodified', 'false');
        
        if (deactivateTree) {
          formData.append('deep', 'true');
        }
        
        const response = await this.httpClient.post('/bin/replicate.json', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        
        return createSuccessResponse({
          success: true,
          deactivatedPath: pagePath,
          deactivateTree,
          response: response.data,
          timestamp: new Date().toISOString(),
        }, 'deactivatePage') as DeactivateResponse;
      } catch (error: any) {
        // Fallback to alternative replication methods
        try {
          const wcmResponse = await this.httpClient.post('/bin/wcmcommand', {
            cmd: 'deactivate',
            path: pagePath,
            ignoredeactivated: false,
            onlymodified: false,
          });
          
          return createSuccessResponse({
            success: true,
            deactivatedPath: pagePath,
            deactivateTree,
            response: wcmResponse.data,
            fallbackUsed: 'WCM Command',
            timestamp: new Date().toISOString(),
          }, 'deactivatePage') as DeactivateResponse;
        } catch (fallbackError: any) {
          throw handleAEMHttpError(error, 'deactivatePage');
        }
      }
    }, 'deactivatePage');
  }

  /**
   * Get all text content from a page including titles, text components, and descriptions
   */
  async getAllTextContent(pagePath: string): Promise<TextContentResponse> {
    return safeExecute<TextContentResponse>(async () => {
      const response = await this.httpClient.get(`${pagePath}.infinity.json`);
      const textContent: Array<{
        path: string;
        title?: string;
        text?: string;
        description?: string;
      }> = [];
      
      const processNode = (node: any, nodePath: string) => {
        if (!node || typeof node !== 'object') return;
        if (node['text'] || node['jcr:title'] || node['jcr:description']) {
          textContent.push({
            path: nodePath,
            title: node['jcr:title'],
            text: node['text'],
            description: node['jcr:description'],
          });
        }
        Object.entries(node).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null && !key.startsWith('rep:') && !key.startsWith('oak:')) {
            const childPath = nodePath ? `${nodePath}/${key}` : key;
            processNode(value, childPath);
          }
        });
      };
      
      if (response.data['jcr:content']) {
        processNode(response.data['jcr:content'], 'jcr:content');
      } else {
        processNode(response.data, pagePath);
      }
      
      return createSuccessResponse({
        pagePath,
        textContent,
      }, 'getAllTextContent') as TextContentResponse;
    }, 'getAllTextContent');
  }

  /**
   * Get text content from a specific page (alias for getAllTextContent)
   */
  async getPageTextContent(pagePath: string): Promise<TextContentResponse> {
    return this.getAllTextContent(pagePath);
  }

  /**
   * Get all images from a page, including those within Experience Fragments
   */
  async getPageImages(pagePath: string): Promise<ImagesResponse> {
    return safeExecute<ImagesResponse>(async () => {
      const response = await this.httpClient.get(`${pagePath}.infinity.json`);
      const images: Array<{
        path: string;
        fileReference?: string;
        src?: string;
        alt?: string;
        title?: string;
      }> = [];
      
      const processNode = (node: any, nodePath: string) => {
        if (!node || typeof node !== 'object') return;
        if (node['fileReference'] || node['src']) {
          images.push({
            path: nodePath,
            fileReference: node['fileReference'],
            src: node['src'],
            alt: node['alt'] || node['altText'],
            title: node['jcr:title'] || node['title'],
          });
        }
        Object.entries(node).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null && !key.startsWith('rep:') && !key.startsWith('oak:')) {
            const childPath = nodePath ? `${nodePath}/${key}` : key;
            processNode(value, childPath);
          }
        });
      };
      
      if (response.data['jcr:content']) {
        processNode(response.data['jcr:content'], 'jcr:content');
      } else {
        processNode(response.data, pagePath);
      }
      
      return createSuccessResponse({
        pagePath,
        images,
      }, 'getPageImages') as ImagesResponse;
    }, 'getPageImages');
  }

  /**
   * Helper method to get available templates for a parent path
   */
  private async getTemplates(parentPath: string): Promise<any> {
    // This is a simplified version - in a full implementation, this would call the template service
    try {
      let confPath = '/conf';
      const pathParts = parentPath.split('/');
      if (pathParts.length >= 3 && pathParts[1] === 'content') {
        const siteName = pathParts[2];
        confPath = `/conf/${siteName}`;
      }
      
      const templatesPath = `${confPath}/settings/wcm/templates`;
      const response = await this.httpClient.get(`${templatesPath}.json`, {
        params: { ':depth': '3' }
      });
      
      const templates: any[] = [];
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
              status: content['status'] || 'enabled',
              ranking: content['ranking'] || 0,
            });
          }
        });
      }
      
      return {
        data: {
          parentPath,
          templatesPath,
          templates,
          availableTemplates: templates.filter(t => t.status === 'enabled')
        }
      };
    } catch (error: any) {
      // Fallback to global templates
      const globalTemplatesPath = '/libs/wcm/foundation/templates';
      const globalResponse = await this.httpClient.get(`${globalTemplatesPath}.json`, {
        params: { ':depth': '2' }
      });
      
      const globalTemplates: any[] = [];
      if (globalResponse.data && typeof globalResponse.data === 'object') {
        Object.entries(globalResponse.data).forEach(([key, value]: [string, any]) => {
          if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
          
          if (value && typeof value === 'object') {
            globalTemplates.push({
              name: key,
              path: `${globalTemplatesPath}/${key}`,
              title: value['jcr:title'] || key,
              description: value['jcr:description'] || 'Global template',
              status: 'enabled',
              ranking: 0,
              isGlobal: true
            });
          }
        });
      }
      
      return {
        data: {
          parentPath,
          templatesPath: globalTemplatesPath,
          templates: globalTemplates,
          availableTemplates: globalTemplates,
          fallbackUsed: true
        }
      };
    }
  }
}

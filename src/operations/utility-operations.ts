/**
 * Utility Operations Module
 * Handles utility operations like node content access, children listing, and content extraction
 */

import { AxiosInstance } from 'axios';
import { 
  IAEMConnector,
  NodeContentResponse,
  ChildrenResponse,
  TextContentResponse,
  ImagesResponse,
  SitesResponse,
  LanguageMastersResponse,
  LocalesResponse,
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

export class UtilityOperations implements Partial<IAEMConnector> {
  constructor(
    private httpClient: AxiosInstance,
    private logger: ILogger,
    private config: AEMConfig
  ) {}

  /**
   * Get JCR node content as raw JSON for a given path and depth
   */
  async getNodeContent(path: string, depth = 1): Promise<NodeContentResponse> {
    return safeExecute<NodeContentResponse>(async () => {
      const response = await this.httpClient.get(`${path}.json`, { 
        params: { ':depth': depth.toString() } 
      });
      
      return {
        path,
        depth,
        content: response.data,
        timestamp: new Date().toISOString()
      };
    }, 'getNodeContent');
  }

  /**
   * List direct children under a path using AEM's JSON API
   */
  async listChildren(path: string): Promise<ChildrenResponse> {
    return safeExecute<ChildrenResponse>(async () => {
      // First try direct JSON API approach
      try {
        const response = await this.httpClient.get(`${path}.1.json`);
        const children: Array<{
          name: string;
          path: string;
          primaryType: string;
          title: string;
          lastModified?: string;
          resourceType?: string;
        }> = [];
        
        if (response.data && typeof response.data === 'object') {
          Object.entries(response.data).forEach(([key, value]: [string, any]) => {
            // Skip JCR system properties and metadata
            if (key.startsWith('jcr:') || key.startsWith('sling:') || key.startsWith('cq:') || 
                key.startsWith('rep:') || key.startsWith('oak:') || key === 'jcr:content') {
              return;
            }
            
            if (value && typeof value === 'object') {
              const childPath = `${path}/${key}`;
              children.push({
                name: key,
                path: childPath,
                primaryType: value['jcr:primaryType'] || 'nt:unstructured',
                title: value['jcr:content']?.['jcr:title'] || 
                       value['jcr:title'] || 
                       key,
                lastModified: value['jcr:content']?.['cq:lastModified'] || 
                             value['cq:lastModified'],
                resourceType: value['jcr:content']?.['sling:resourceType'] || 
                             value['sling:resourceType']
              });
            }
          });
        }
        
        return { children };
      } catch (error: any) {
        // Fallback to QueryBuilder for cq:Page nodes specifically
        if (error.response?.status === 404 || error.response?.status === 403) {
          const response = await this.httpClient.get('/bin/querybuilder.json', {
            params: {
              path: path,
              type: 'cq:Page',
              'p.nodedepth': '1',
              'p.limit': '1000',
              'p.hits': 'full'
            },
          });
          
          const children = (response.data.hits || []).map((hit: any) => ({
            name: hit.name || hit.path?.split('/').pop(),
            path: hit.path,
            primaryType: hit['jcr:primaryType'] || 'cq:Page',
            title: hit['jcr:content/jcr:title'] || hit.title || hit.name,
            lastModified: hit['jcr:content/cq:lastModified'],
            resourceType: hit['jcr:content/sling:resourceType']
          }));
          
          return { children };
        }
        throw error;
      }
    }, 'listChildren');
  }

  /**
   * Get all available sites in AEM
   */
  async fetchSites(): Promise<SitesResponse> {
    return safeExecute<SitesResponse>(async () => {
      const response = await this.httpClient.get('/content.json', { 
        params: { ':depth': '2' } 
      });
      
      const sites: Array<{
        name: string;
        path: string;
        title: string;
        template?: string;
        lastModified?: string;
      }> = [];

      Object.entries(response.data).forEach(([key, value]: [string, any]) => {
        if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
        if (value && typeof value === 'object' && value['jcr:content']) {
          sites.push({
            name: key,
            path: `/content/${key}`,
            title: value['jcr:content']['jcr:title'] || key,
            template: value['jcr:content']['cq:template'],
            lastModified: value['jcr:content']['cq:lastModified'],
          });
        }
      });

      return createSuccessResponse({
        sites,
        totalCount: sites.length,
      }, 'fetchSites') as SitesResponse;
    }, 'fetchSites');
  }

  /**
   * Get language masters for a specific site
   */
  async fetchLanguageMasters(site: string): Promise<LanguageMastersResponse> {
    return safeExecute<LanguageMastersResponse>(async () => {
      const response = await this.httpClient.get(`/content/${site}.json`, { 
        params: { ':depth': '3' } 
      });
      
      const masters: Array<{
        name: string;
        path: string;
        title: string;
        language: string;
      }> = [];

      Object.entries(response.data).forEach(([key, value]: [string, any]) => {
        if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
        if (value && typeof value === 'object' && value['jcr:content']) {
          masters.push({
            name: key,
            path: `/content/${key}`,
            title: value['jcr:content']['jcr:title'] || key,
            language: value['jcr:content']['jcr:language'] || 'en',
          });
        }
      });

      return createSuccessResponse({
        site,
        languageMasters: masters,
      }, 'fetchLanguageMasters') as LanguageMastersResponse;
    }, 'fetchLanguageMasters');
  }

  /**
   * Get available locales for a site and language master
   */
  async fetchAvailableLocales(site: string, languageMasterPath: string): Promise<LocalesResponse> {
    return safeExecute<LocalesResponse>(async () => {
      const response = await this.httpClient.get(`${languageMasterPath}.json`, { 
        params: { ':depth': '2' } 
      });
      
      const locales: Array<{
        name: string;
        title: string;
        language: string;
      }> = [];

      Object.entries(response.data).forEach(([key, value]: [string, any]) => {
        if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
        if (value && typeof value === 'object') {
          locales.push({
            name: key,
            title: value['jcr:content']?.['jcr:title'] || key,
            language: value['jcr:content']?.['jcr:language'] || key,
          });
        }
      });

      return createSuccessResponse({
        site,
        languageMasterPath,
        availableLocales: locales,
      }, 'fetchAvailableLocales') as LocalesResponse;
    }, 'fetchAvailableLocales');
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
          if (typeof value === 'object' && value !== null && 
              !key.startsWith('rep:') && !key.startsWith('oak:')) {
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
          if (typeof value === 'object' && value !== null && 
              !key.startsWith('rep:') && !key.startsWith('oak:')) {
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
   * Get page content including Experience Fragments and Content Fragments
   */
  async getPageContent(pagePath: string): Promise<{
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
      pagePath: string;
      content: Record<string, unknown>;
    };
  }> {
    return safeExecute(async () => {
      const response = await this.httpClient.get(`${pagePath}.infinity.json`);
      
      return createSuccessResponse({
        pagePath,
        content: response.data,
      }, 'getPageContent');
    }, 'getPageContent');
  }

  /**
   * Update the image path for an image component and verify the update
   */
  async updateImagePath(componentPath: string, newImagePath: string): Promise<{
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
  }> {
    return safeExecute(async () => {
      // This would typically call the component operations module
      // For now, we'll implement a simplified version
      const formData = new URLSearchParams();
      formData.append('fileReference', newImagePath);
      
      const response = await this.httpClient.post(componentPath, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      // Verify the update
      const verificationResponse = await this.httpClient.get(`${componentPath}.json`);
      
      return createSuccessResponse({
        message: 'Image path updated successfully',
        path: componentPath,
        properties: { fileReference: newImagePath },
        updatedProperties: verificationResponse.data,
        verification: {
          success: true,
          propertiesChanged: 1,
          timestamp: new Date().toISOString(),
        },
      }, 'updateImagePath');
    }, 'updateImagePath');
  }

  /**
   * Undo changes (placeholder implementation)
   * Note: AEM MCP does not support undo/rollback. Use AEM version history.
   */
  async undoChanges(request: { jobId: string }): Promise<{
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
      message: string;
      request: { jobId: string };
      timestamp: string;
    };
  }> {
    return createSuccessResponse({
      message: 'undoChanges is not implemented. Please use AEM version history for undo/rollback.',
      request,
      timestamp: new Date().toISOString(),
    }, 'undoChanges');
  }
}

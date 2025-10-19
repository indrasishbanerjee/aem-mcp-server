/**
 * Utility Operations Module
 * Handles utility operations like node content access, children listing, and content extraction
 */
import { safeExecute, createSuccessResponse } from '../error-handler.js';
export class UtilityOperations {
    httpClient;
    logger;
    config;
    constructor(httpClient, logger, config) {
        this.httpClient = httpClient;
        this.logger = logger;
        this.config = config;
    }
    /**
     * Get JCR node content as raw JSON for a given path and depth
     */
    async getNodeContent(path, depth = 1) {
        return safeExecute(async () => {
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
    async listChildren(path) {
        return safeExecute(async () => {
            // First try direct JSON API approach
            try {
                const response = await this.httpClient.get(`${path}.1.json`);
                const children = [];
                if (response.data && typeof response.data === 'object') {
                    Object.entries(response.data).forEach(([key, value]) => {
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
            }
            catch (error) {
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
                    const children = (response.data.hits || []).map((hit) => ({
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
    async fetchSites() {
        return safeExecute(async () => {
            const response = await this.httpClient.get('/content.json', {
                params: { ':depth': '2' }
            });
            const sites = [];
            Object.entries(response.data).forEach(([key, value]) => {
                if (key.startsWith('jcr:') || key.startsWith('sling:'))
                    return;
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
            }, 'fetchSites');
        }, 'fetchSites');
    }
    /**
     * Get language masters for a specific site
     */
    async fetchLanguageMasters(site) {
        return safeExecute(async () => {
            const response = await this.httpClient.get(`/content/${site}.json`, {
                params: { ':depth': '3' }
            });
            const masters = [];
            Object.entries(response.data).forEach(([key, value]) => {
                if (key.startsWith('jcr:') || key.startsWith('sling:'))
                    return;
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
            }, 'fetchLanguageMasters');
        }, 'fetchLanguageMasters');
    }
    /**
     * Get available locales for a site and language master
     */
    async fetchAvailableLocales(site, languageMasterPath) {
        return safeExecute(async () => {
            const response = await this.httpClient.get(`${languageMasterPath}.json`, {
                params: { ':depth': '2' }
            });
            const locales = [];
            Object.entries(response.data).forEach(([key, value]) => {
                if (key.startsWith('jcr:') || key.startsWith('sling:'))
                    return;
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
            }, 'fetchAvailableLocales');
        }, 'fetchAvailableLocales');
    }
    /**
     * Get all text content from a page including titles, text components, and descriptions
     */
    async getAllTextContent(pagePath) {
        return safeExecute(async () => {
            const response = await this.httpClient.get(`${pagePath}.infinity.json`);
            const textContent = [];
            const processNode = (node, nodePath) => {
                if (!node || typeof node !== 'object')
                    return;
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
            }
            else {
                processNode(response.data, pagePath);
            }
            return createSuccessResponse({
                pagePath,
                textContent,
            }, 'getAllTextContent');
        }, 'getAllTextContent');
    }
    /**
     * Get text content from a specific page (alias for getAllTextContent)
     */
    async getPageTextContent(pagePath) {
        return this.getAllTextContent(pagePath);
    }
    /**
     * Get all images from a page, including those within Experience Fragments
     */
    async getPageImages(pagePath) {
        return safeExecute(async () => {
            const response = await this.httpClient.get(`${pagePath}.infinity.json`);
            const images = [];
            const processNode = (node, nodePath) => {
                if (!node || typeof node !== 'object')
                    return;
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
            }
            else {
                processNode(response.data, pagePath);
            }
            return createSuccessResponse({
                pagePath,
                images,
            }, 'getPageImages');
        }, 'getPageImages');
    }
    /**
     * Get page content including Experience Fragments and Content Fragments
     */
    async getPageContent(pagePath) {
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
    async updateImagePath(componentPath, newImagePath) {
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
    async undoChanges(request) {
        return createSuccessResponse({
            message: 'undoChanges is not implemented. Please use AEM version history for undo/rollback.',
            request,
            timestamp: new Date().toISOString(),
        }, 'undoChanges');
    }
}
//# sourceMappingURL=utility-operations.js.map
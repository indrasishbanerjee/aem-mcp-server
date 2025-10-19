/**
 * Unit Tests for Page Operations
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PageOperations } from '../../operations/page-operations.js';
import { mockHttpClient, mockLogger, mockConfig, createMockResponse, createMockError, mockAEMResponses } from '../setup.js';
describe('PageOperations', () => {
    let pageOps;
    beforeEach(() => {
        pageOps = new PageOperations(mockHttpClient, mockLogger, mockConfig.aem);
        jest.clearAllMocks();
    });
    describe('createPage', () => {
        it('should create a page successfully', async () => {
            const request = {
                parentPath: '/content/test',
                title: 'Test Page',
                template: '/conf/test/settings/wcm/templates/test-template'
            };
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageContent));
            mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));
            mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageContent));
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse({}, 200));
            const result = await pageOps.createPage(request);
            expect(result.success).toBe(true);
            expect(result.data.pagePath).toBe('/content/test/test-page');
            expect(result.data.title).toBe('Test Page');
            expect(result.data.templateUsed).toBe('/conf/test/settings/wcm/templates/test-template');
            expect(result.data.jcrContentCreated).toBe(true);
        });
        it('should throw error for invalid parent path', async () => {
            const request = {
                parentPath: '/invalid/path',
                title: 'Test Page'
            };
            await expect(pageOps.createPage(request)).rejects.toThrow();
        });
        it('should throw error when template not found', async () => {
            const request = {
                parentPath: '/content/test',
                title: 'Test Page',
                template: '/conf/test/settings/wcm/templates/nonexistent'
            };
            mockHttpClient.get.mockRejectedValueOnce(createMockError('Template not found', 404));
            await expect(pageOps.createPage(request)).rejects.toThrow('Template not found');
        });
        it('should auto-select template when not provided', async () => {
            const request = {
                parentPath: '/content/test',
                title: 'Test Page'
            };
            // Mock template discovery
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.templates));
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageContent));
            mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));
            mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageContent));
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse({}, 200));
            const result = await pageOps.createPage(request);
            expect(result.success).toBe(true);
            expect(result.data.templateUsed).toBeDefined();
        });
    });
    describe('deletePage', () => {
        it('should delete a page successfully', async () => {
            const request = {
                pagePath: '/content/test/test-page'
            };
            mockHttpClient.delete.mockResolvedValueOnce(createMockResponse({}));
            const result = await pageOps.deletePage(request);
            expect(result.success).toBe(true);
            expect(result.data.deletedPath).toBe('/content/test/test-page');
        });
        it('should use fallback method when DELETE fails', async () => {
            const request = {
                pagePath: '/content/test/test-page'
            };
            mockHttpClient.delete.mockRejectedValueOnce(createMockError('Method not allowed', 405));
            mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));
            const result = await pageOps.deletePage(request);
            expect(result.success).toBe(true);
            expect(mockHttpClient.post).toHaveBeenCalledWith('/bin/wcmcommand', {
                cmd: 'deletePage',
                path: '/content/test/test-page',
                force: 'false'
            });
        });
        it('should throw error for invalid page path', async () => {
            const request = {
                pagePath: '/invalid/path'
            };
            await expect(pageOps.deletePage(request)).rejects.toThrow();
        });
    });
    describe('listPages', () => {
        it('should list pages successfully using JSON API', async () => {
            const siteRoot = '/content/test';
            const mockResponse = {
                'page1': {
                    'jcr:primaryType': 'cq:Page',
                    'jcr:content': {
                        'jcr:title': 'Page 1',
                        'cq:template': '/conf/test/settings/wcm/templates/page-template',
                        'cq:lastModified': '2024-01-01T00:00:00.000Z',
                        'cq:lastModifiedBy': 'admin',
                        'sling:resourceType': 'foundation/components/page'
                    }
                },
                'page2': {
                    'jcr:primaryType': 'cq:Page',
                    'jcr:content': {
                        'jcr:title': 'Page 2',
                        'cq:template': '/conf/test/settings/wcm/templates/page-template',
                        'cq:lastModified': '2024-01-02T00:00:00.000Z',
                        'cq:lastModifiedBy': 'admin',
                        'sling:resourceType': 'foundation/components/page'
                    }
                }
            };
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockResponse));
            const result = await pageOps.listPages(siteRoot);
            expect(result.success).toBe(true);
            expect(result.data.pages).toHaveLength(2);
            expect(result.data.pages[0].name).toBe('page1');
            expect(result.data.pages[0].title).toBe('Page 1');
            expect(result.data.pages[0].type).toBe('page');
        });
        it('should fallback to QueryBuilder when JSON API fails', async () => {
            const siteRoot = '/content/test';
            mockHttpClient.get.mockRejectedValueOnce(createMockError('Not found', 404));
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageList));
            const result = await pageOps.listPages(siteRoot);
            expect(result.success).toBe(true);
            expect(result.data.pages).toHaveLength(2);
            expect(result.data.fallbackUsed).toBe('QueryBuilder');
        });
        it('should respect depth and limit parameters', async () => {
            const siteRoot = '/content/test';
            const depth = 2;
            const limit = 10;
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse({}));
            await pageOps.listPages(siteRoot, depth, limit);
            expect(mockHttpClient.get).toHaveBeenCalledWith('/content/test.2.json');
        });
    });
    describe('getPageContent', () => {
        it('should get page content successfully', async () => {
            const pagePath = '/content/test/page1';
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageContent));
            const result = await pageOps.getPageContent(pagePath);
            expect(result.success).toBe(true);
            expect(result.data.pagePath).toBe(pagePath);
            expect(result.data.content).toEqual(mockAEMResponses.pageContent);
        });
    });
    describe('getPageProperties', () => {
        it('should get page properties successfully', async () => {
            const pagePath = '/content/test/page1';
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageContent['jcr:content']));
            const result = await pageOps.getPageProperties(pagePath);
            expect(result.success).toBe(true);
            expect(result.data.pagePath).toBe(pagePath);
            expect(result.data.properties.title).toBe('Test Page');
            expect(result.data.properties.template).toBe('/conf/test/settings/wcm/templates/test-template');
        });
    });
    describe('activatePage', () => {
        it('should activate a page successfully', async () => {
            const request = {
                pagePath: '/content/test/page1',
                activateTree: false
            };
            mockHttpClient.post.mockResolvedValueOnce(createMockResponse({ success: true }));
            const result = await pageOps.activatePage(request);
            expect(result.success).toBe(true);
            expect(result.data.activatedPath).toBe('/content/test/page1');
            expect(result.data.activateTree).toBe(false);
            expect(mockHttpClient.post).toHaveBeenCalledWith('/bin/replicate.json', expect.any(URLSearchParams), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
        });
        it('should use fallback method when replication fails', async () => {
            const request = {
                pagePath: '/content/test/page1',
                activateTree: true
            };
            mockHttpClient.post.mockRejectedValueOnce(createMockError('Replication failed'));
            mockHttpClient.post.mockResolvedValueOnce(createMockResponse({ success: true }));
            const result = await pageOps.activatePage(request);
            expect(result.success).toBe(true);
            expect(result.data.fallbackUsed).toBe('WCM Command');
        });
        it('should throw error for invalid page path', async () => {
            const request = {
                pagePath: '/invalid/path'
            };
            await expect(pageOps.activatePage(request)).rejects.toThrow();
        });
    });
    describe('deactivatePage', () => {
        it('should deactivate a page successfully', async () => {
            const request = {
                pagePath: '/content/test/page1',
                deactivateTree: false
            };
            mockHttpClient.post.mockResolvedValueOnce(createMockResponse({ success: true }));
            const result = await pageOps.deactivatePage(request);
            expect(result.success).toBe(true);
            expect(result.data.deactivatedPath).toBe('/content/test/page1');
            expect(result.data.deactivateTree).toBe(false);
        });
    });
    describe('getAllTextContent', () => {
        it('should extract text content from page', async () => {
            const pagePath = '/content/test/page1';
            const mockPageContent = {
                'jcr:content': {
                    'jcr:title': 'Page Title',
                    'text': 'Page text content',
                    'jcr:description': 'Page description',
                    'component1': {
                        'text': 'Component text',
                        'jcr:title': 'Component title'
                    }
                }
            };
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockPageContent));
            const result = await pageOps.getAllTextContent(pagePath);
            expect(result.success).toBe(true);
            expect(result.data.textContent).toHaveLength(3);
            expect(result.data.textContent[0].title).toBe('Page Title');
            expect(result.data.textContent[1].text).toBe('Page text content');
            expect(result.data.textContent[2].text).toBe('Component text');
        });
    });
    describe('getPageImages', () => {
        it('should extract images from page', async () => {
            const pagePath = '/content/test/page1';
            const mockPageContent = {
                'jcr:content': {
                    'image1': {
                        'fileReference': '/content/dam/test/image1.jpg',
                        'alt': 'Image 1',
                        'title': 'Image Title 1'
                    },
                    'component1': {
                        'image': {
                            'src': '/content/dam/test/image2.jpg',
                            'altText': 'Image 2'
                        }
                    }
                }
            };
            mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockPageContent));
            const result = await pageOps.getPageImages(pagePath);
            expect(result.success).toBe(true);
            expect(result.data.images).toHaveLength(2);
            expect(result.data.images[0].fileReference).toBe('/content/dam/test/image1.jpg');
            expect(result.data.images[1].src).toBe('/content/dam/test/image2.jpg');
        });
    });
});
//# sourceMappingURL=page-operations.test.js.map
/**
 * Unit tests for ReplicationOperations
 */
import { ReplicationOperations } from '../../operations/replication-operations.js';
// Mock dependencies
const mockHttpClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    request: jest.fn(),
    head: jest.fn(),
    options: jest.fn(),
    defaults: {},
    interceptors: {},
};
const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    methodStart: jest.fn(),
    methodEnd: jest.fn(),
    methodError: jest.fn(),
    httpRequest: jest.fn(),
    aemOperation: jest.fn(),
    performance: jest.fn(),
};
const mockAEMConfig = {
    host: 'http://localhost:4502',
    author: 'http://localhost:4502',
    publish: 'http://localhost:4503',
    serviceUser: {
        username: 'admin',
        password: 'admin',
    },
    endpoints: {
        content: '/content',
        dam: '/content/dam',
        query: '/bin/querybuilder.json',
        crxde: '/crx/de',
        jcr: '',
        replicate: '/bin/replicate.json',
        wcmcommand: '/bin/wcmcommand',
    },
    contentPaths: {
        sitesRoot: '/content',
        assetsRoot: '/content/dam',
        templatesRoot: '/conf',
        experienceFragmentsRoot: '/content/experience-fragments',
    },
    replication: {
        publisherUrls: ['http://localhost:4503'],
        defaultReplicationAgent: 'publish',
    },
    components: {
        allowedTypes: ['text', 'image', 'teaser'],
        defaultProperties: {},
    },
    queries: {
        maxLimit: 1000,
        defaultLimit: 20,
        timeoutMs: 30000,
    },
    validation: {
        maxDepth: 10,
        allowedLocales: ['en', 'en_us', 'en_gb'],
    },
    siteName: 'we-retail',
    strictReplication: false,
};
describe('ReplicationOperations', () => {
    let replicationOps;
    beforeEach(() => {
        replicationOps = new ReplicationOperations(mockHttpClient, mockLogger, mockAEMConfig);
        jest.clearAllMocks();
    });
    describe('activatePage', () => {
        it('should activate page successfully', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    path: '/content/test/page',
                    message: 'Page activated successfully',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const request = {
                pagePath: '/content/test/page',
                activateTree: false,
            };
            const result = await replicationOps.activatePage(request);
            expect(result.success).toBe(true);
            expect(result.operation).toBe('activatePage');
            expect(result.data.path).toBe('/content/test/page');
            expect(result.data.success).toBe(true);
            expect(mockHttpClient.post).toHaveBeenCalledWith('/bin/replicate.json', expect.any(URLSearchParams), expect.objectContaining({
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }));
        });
        it('should activate page tree when requested', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    path: '/content/test/page',
                    message: 'Page tree activated successfully',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const request = {
                pagePath: '/content/test/page',
                activateTree: true,
            };
            await replicationOps.activatePage(request);
            const formData = mockHttpClient.post.mock.calls[0][1];
            expect(formData.get('deep')).toBe('true');
        });
    });
    describe('deactivatePage', () => {
        it('should deactivate page successfully', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    path: '/content/test/page',
                    message: 'Page deactivated successfully',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const request = {
                pagePath: '/content/test/page',
                deactivateTree: false,
            };
            const result = await replicationOps.deactivatePage(request);
            expect(result.success).toBe(true);
            expect(result.operation).toBe('deactivatePage');
            expect(result.data.path).toBe('/content/test/page');
            expect(result.data.success).toBe(true);
        });
    });
    describe('unpublishContent', () => {
        it('should unpublish content successfully', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    message: 'Content unpublished successfully',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const request = {
                contentPaths: ['/content/test/page'],
                unpublishTree: false,
            };
            const result = await replicationOps.unpublishContent(request);
            expect(result.success).toBe(true);
            expect(result.operation).toBe('unpublishContent');
            expect(result.data.results).toHaveLength(1);
            expect(result.data.results[0].success).toBe(true);
            expect(result.data.results[0].path).toBe('/content/test/page');
        });
        it('should handle multiple content paths', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    message: 'Content unpublished successfully',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const request = {
                contentPaths: ['/content/test/page1', '/content/test/page2'],
                unpublishTree: false,
            };
            const result = await replicationOps.unpublishContent(request);
            expect(result.success).toBe(true);
            expect(result.data.results).toHaveLength(2);
            expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
        });
        it('should handle unpublish failure', async () => {
            mockHttpClient.post.mockRejectedValueOnce(new Error('Unpublish failed'));
            const request = {
                contentPaths: ['/content/test/page'],
                unpublishTree: false,
            };
            const result = await replicationOps.unpublishContent(request);
            expect(result.success).toBe(true);
            expect(result.data.results).toHaveLength(1);
            expect(result.data.results[0].success).toBe(false);
            expect(result.data.results[0].error).toBeDefined();
        });
        it('should validate content paths', async () => {
            const request = {
                contentPaths: [],
                unpublishTree: false,
            };
            await expect(replicationOps.unpublishContent(request)).rejects.toThrow();
        });
    });
    describe('replicateAndPublish', () => {
        it('should replicate to multiple locales successfully', async () => {
            const mockMSMResponse = {
                data: {
                    replicationId: 'msm_123',
                    message: 'MSM replication successful',
                },
            };
            const mockActivateResponse = {
                data: {
                    success: true,
                    message: 'Content activated',
                },
            };
            mockHttpClient.get.mockResolvedValueOnce({
                data: {
                    'jcr:content': {
                        'cq:liveSyncConfig': true, // MSM content
                    },
                },
            });
            mockHttpClient.post
                .mockResolvedValueOnce(mockMSMResponse) // MSM replication
                .mockResolvedValueOnce(mockActivateResponse); // Activation
            const selectedLocales = ['en-us', 'en-gb'];
            const componentData = { title: 'Test Title', description: 'Test Description' };
            const localizedOverrides = {
                'en-us': { title: 'US Title' },
                'en-gb': { title: 'UK Title' },
            };
            const result = await replicationOps.replicateAndPublish(selectedLocales, componentData, localizedOverrides);
            expect(result.success).toBe(true);
            expect(result.operation).toBe('replicateAndPublish');
            expect(result.data.selectedLocales).toEqual(selectedLocales);
            expect(result.data.results).toHaveLength(2);
            expect(result.data.results[0].success).toBe(true);
            expect(result.data.results[1].success).toBe(true);
            expect(result.data.summary.total).toBe(2);
            expect(result.data.summary.successful).toBe(2);
            expect(result.data.summary.failed).toBe(0);
        });
        it('should handle standard replication for non-MSM content', async () => {
            const mockActivateResponse = {
                data: {
                    success: true,
                    message: 'Content activated',
                },
            };
            mockHttpClient.get.mockResolvedValueOnce({
                data: {
                    'jcr:content': {}, // No MSM properties
                },
            });
            mockHttpClient.post
                .mockResolvedValueOnce({ data: {} }) // Standard replication
                .mockResolvedValueOnce(mockActivateResponse); // Activation
            const selectedLocales = ['en-us'];
            const componentData = { title: 'Test Title' };
            const result = await replicationOps.replicateAndPublish(selectedLocales, componentData);
            expect(result.success).toBe(true);
            expect(result.data.results).toHaveLength(1);
            expect(result.data.results[0].success).toBe(true);
        });
        it('should handle partial replication failures', async () => {
            mockHttpClient.get
                .mockResolvedValueOnce({
                data: { 'jcr:content': {} }, // First locale - standard replication
            })
                .mockRejectedValueOnce(new Error('MSM check failed')); // Second locale - MSM check fails
            mockHttpClient.post
                .mockResolvedValueOnce({ data: {} }) // First locale replication
                .mockResolvedValueOnce({ data: { success: true } }); // First locale activation
            const selectedLocales = ['en-us', 'en-gb'];
            const componentData = { title: 'Test Title' };
            const result = await replicationOps.replicateAndPublish(selectedLocales, componentData);
            expect(result.success).toBe(false); // Overall failure due to partial failure
            expect(result.data.results).toHaveLength(2);
            expect(result.data.results[0].success).toBe(true);
            expect(result.data.results[1].success).toBe(false);
            expect(result.data.summary.successful).toBe(1);
            expect(result.data.summary.failed).toBe(1);
        });
        it('should validate locale format', async () => {
            const selectedLocales = ['invalid-locale-format'];
            const componentData = { title: 'Test Title' };
            await expect(replicationOps.replicateAndPublish(selectedLocales, componentData)).rejects.toThrow();
        });
        it('should validate empty locales array', async () => {
            const selectedLocales = [];
            const componentData = { title: 'Test Title' };
            await expect(replicationOps.replicateAndPublish(selectedLocales, componentData)).rejects.toThrow();
        });
        it('should handle strict replication with rollback', async () => {
            // Create config with strict replication enabled
            const strictConfig = { ...mockAEMConfig, strictReplication: true };
            const strictReplicationOps = new ReplicationOperations(mockHttpClient, mockLogger, strictConfig);
            mockHttpClient.get
                .mockResolvedValueOnce({
                data: { 'jcr:content': {} }, // First locale succeeds
            })
                .mockResolvedValueOnce({
                data: { 'jcr:content': {} }, // Second locale fails during replication
            });
            mockHttpClient.post
                .mockResolvedValueOnce({ data: {} }) // First locale replication
                .mockResolvedValueOnce({ data: { success: true } }) // First locale activation
                .mockRejectedValueOnce(new Error('Replication failed')); // Second locale fails
            const selectedLocales = ['en-us', 'en-gb'];
            const componentData = { title: 'Test Title' };
            const result = await strictReplicationOps.replicateAndPublish(selectedLocales, componentData);
            expect(result.success).toBe(false);
            expect(result.data.results).toHaveLength(2);
            expect(result.data.results[0].success).toBe(false); // Rolled back
            expect(result.data.results[1].success).toBe(false); // Failed
        });
    });
    describe('getReplicationStatus', () => {
        it('should get replication status successfully', async () => {
            const mockResponse = {
                data: {
                    contentPath: '/content/test/page',
                    status: 'ACTIVATED',
                    lastActivated: '2024-01-01T10:00:00Z',
                    activatedBy: 'admin',
                },
            };
            mockHttpClient.get.mockResolvedValueOnce(mockResponse);
            const result = await replicationOps.getReplicationStatus('/content/test/page');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('getReplicationStatus');
            expect(result.data.contentPath).toBe('/content/test/page');
            expect(result.data.status).toBe('ACTIVATED');
            expect(mockHttpClient.get).toHaveBeenCalledWith('/bin/replicate.json', {
                params: { path: '/content/test/page' },
            });
        });
    });
});
//# sourceMappingURL=replication-operations.test.js.map
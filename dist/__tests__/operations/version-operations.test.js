/**
 * Unit tests for VersionOperations
 */
import { VersionOperations } from '../../operations/version-operations.js';
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
};
describe('VersionOperations', () => {
    let versionOps;
    beforeEach(() => {
        versionOps = new VersionOperations(mockHttpClient, mockLogger, mockAEMConfig);
        jest.clearAllMocks();
    });
    describe('getVersionHistory', () => {
        it('should get version history successfully', async () => {
            const mockResponse = {
                data: {
                    '1.0': {
                        'jcr:frozenNode': {
                            'jcr:versionLabel': 'Initial Version',
                            'jcr:created': '2024-01-01T10:00:00Z',
                            'jcr:createdBy': 'admin',
                            'jcr:versionComment': 'Initial version',
                        },
                        'jcr:created': '2024-01-01T10:00:00Z',
                        'jcr:createdBy': 'admin',
                        'jcr:versionComment': 'Initial version',
                        'jcr:isCheckedOut': false,
                    },
                    '1.1': {
                        'jcr:frozenNode': {
                            'jcr:versionLabel': 'Updated Version',
                            'jcr:created': '2024-01-01T11:00:00Z',
                            'jcr:createdBy': 'admin',
                            'jcr:versionComment': 'Updated content',
                        },
                        'jcr:created': '2024-01-01T11:00:00Z',
                        'jcr:createdBy': 'admin',
                        'jcr:versionComment': 'Updated content',
                        'jcr:isCheckedOut': true,
                    },
                },
            };
            mockHttpClient.get.mockResolvedValueOnce(mockResponse);
            const result = await versionOps.getVersionHistory('/content/test/page');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('getVersionHistory');
            expect(result.data.path).toBe('/content/test/page');
            expect(result.data.versions).toHaveLength(2);
            expect(result.data.versions[0].name).toBe('1.1'); // Newest first
            expect(result.data.versions[1].name).toBe('1.0');
            expect(result.data.baseVersion).toBe('1.0'); // Only non-checked out version
            expect(mockHttpClient.get).toHaveBeenCalledWith('/content/test/page.versionhistory.json', expect.objectContaining({
                params: { ':depth': '2' },
            }));
        });
        it('should handle invalid path', async () => {
            await expect(versionOps.getVersionHistory('invalid-path')).rejects.toThrow();
        });
        it('should handle version history not found', async () => {
            const mockError = {
                response: {
                    status: 404,
                    data: { message: 'Version history not found' },
                },
            };
            mockHttpClient.get.mockRejectedValueOnce(mockError);
            await expect(versionOps.getVersionHistory('/content/test/page')).rejects.toThrow();
        });
    });
    describe('createVersion', () => {
        it('should create version successfully', async () => {
            const mockResponse = {
                data: {
                    versionName: '1.2',
                    message: 'Version created successfully',
                },
            };
            mockHttpClient.post
                .mockResolvedValueOnce({ data: {} }) // checkout
                .mockResolvedValueOnce(mockResponse) // createVersion
                .mockResolvedValueOnce({ data: {} }); // checkin
            const result = await versionOps.createVersion('/content/test/page', 'New Version', 'Created new version');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('createVersion');
            expect(result.data.path).toBe('/content/test/page');
            expect(result.data.versionName).toBe('1.2');
            expect(result.data.label).toBe('New Version');
            expect(result.data.comment).toBe('Created new version');
            expect(mockHttpClient.post).toHaveBeenCalledTimes(3); // checkout, createVersion, checkin
        });
        it('should create version without label and comment', async () => {
            const mockResponse = {
                data: {
                    versionName: '1.2',
                    message: 'Version created successfully',
                },
            };
            mockHttpClient.post
                .mockResolvedValueOnce({ data: {} })
                .mockResolvedValueOnce(mockResponse)
                .mockResolvedValueOnce({ data: {} });
            const result = await versionOps.createVersion('/content/test/page');
            expect(result.success).toBe(true);
            expect(result.data.label).toBeUndefined();
            expect(result.data.comment).toBeUndefined();
        });
        it('should handle version creation failure', async () => {
            mockHttpClient.post.mockRejectedValueOnce(new Error('Checkout failed'));
            await expect(versionOps.createVersion('/content/test/page')).rejects.toThrow();
        });
    });
    describe('restoreVersion', () => {
        it('should restore version successfully', async () => {
            const mockVersionHistory = {
                data: {
                    baseVersion: '1.0',
                    versions: [
                        { name: '1.0', created: '2024-01-01T10:00:00Z' },
                        { name: '1.1', created: '2024-01-01T11:00:00Z' },
                    ],
                },
            };
            const mockRestoreResponse = {
                data: {
                    message: 'Version restored successfully',
                },
            };
            mockHttpClient.get.mockResolvedValueOnce(mockVersionHistory);
            mockHttpClient.post.mockResolvedValueOnce(mockRestoreResponse);
            const result = await versionOps.restoreVersion('/content/test/page', '1.0');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('restoreVersion');
            expect(result.data.path).toBe('/content/test/page');
            expect(result.data.restoredVersion).toBe('1.0');
            expect(result.data.previousVersion).toBe('1.0');
            expect(mockHttpClient.post).toHaveBeenCalledWith('/bin/wcm/versioning/restoreVersion', expect.any(URLSearchParams), expect.objectContaining({
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }));
        });
        it('should handle invalid version name', async () => {
            await expect(versionOps.restoreVersion('/content/test/page', '')).rejects.toThrow();
        });
        it('should handle restore failure', async () => {
            mockHttpClient.get.mockRejectedValueOnce(new Error('Version history not found'));
            await expect(versionOps.restoreVersion('/content/test/page', '1.0')).rejects.toThrow();
        });
    });
    describe('compareVersions', () => {
        it('should compare versions successfully', async () => {
            const mockVersion1 = {
                data: {
                    'jcr:title': 'Original Title',
                    'jcr:description': 'Original description',
                    'custom:property': 'old value',
                },
            };
            const mockVersion2 = {
                data: {
                    'jcr:title': 'Updated Title',
                    'jcr:description': 'Updated description',
                    'custom:property': 'new value',
                    'custom:newProperty': 'new property',
                },
            };
            mockHttpClient.get
                .mockResolvedValueOnce(mockVersion1)
                .mockResolvedValueOnce(mockVersion2);
            const result = await versionOps.compareVersions('/content/test/page', '1.0', '1.1');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('compareVersions');
            expect(result.data.path).toBe('/content/test/page');
            expect(result.data.version1).toBe('1.0');
            expect(result.data.version2).toBe('1.1');
            expect(result.data.differences).toHaveLength(4); // 2 modified, 1 added
            expect(result.data.summary.modified).toBe(3);
            expect(result.data.summary.added).toBe(1);
            expect(result.data.summary.removed).toBe(0);
            expect(mockHttpClient.get).toHaveBeenCalledWith('/content/test/page.version.1.0.json', expect.objectContaining({
                params: { ':depth': '2' },
            }));
            expect(mockHttpClient.get).toHaveBeenCalledWith('/content/test/page.version.1.1.json', expect.objectContaining({
                params: { ':depth': '2' },
            }));
        });
        it('should handle identical versions', async () => {
            const mockVersionData = {
                data: {
                    'jcr:title': 'Same Title',
                    'jcr:description': 'Same description',
                },
            };
            mockHttpClient.get
                .mockResolvedValueOnce(mockVersionData)
                .mockResolvedValueOnce(mockVersionData);
            const result = await versionOps.compareVersions('/content/test/page', '1.0', '1.1');
            expect(result.success).toBe(true);
            expect(result.data.differences).toHaveLength(0);
            expect(result.data.summary.modified).toBe(0);
            expect(result.data.summary.added).toBe(0);
            expect(result.data.summary.removed).toBe(0);
        });
        it('should handle invalid version parameters', async () => {
            await expect(versionOps.compareVersions('/content/test/page', '1.0', '1.0')).rejects.toThrow();
            await expect(versionOps.compareVersions('/content/test/page', '', '1.1')).rejects.toThrow();
        });
    });
    describe('deleteVersion', () => {
        it('should delete version successfully', async () => {
            const mockResponse = {
                data: {
                    message: 'Version deleted successfully',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const result = await versionOps.deleteVersion('/content/test/page', '1.1');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('deleteVersion');
            expect(result.data.path).toBe('/content/test/page');
            expect(result.data.deletedVersion).toBe('1.1');
            expect(mockHttpClient.post).toHaveBeenCalledWith('/bin/wcm/versioning/deleteVersion', expect.any(URLSearchParams), expect.objectContaining({
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }));
        });
        it('should handle delete failure', async () => {
            mockHttpClient.post.mockRejectedValueOnce(new Error('Delete failed'));
            await expect(versionOps.deleteVersion('/content/test/page', '1.1')).rejects.toThrow();
        });
    });
    describe('undoChanges', () => {
        it('should restore version when jobId looks like a version', async () => {
            const mockVersionHistory = {
                data: {
                    baseVersion: '1.0',
                    versions: [{ name: '1.0' }],
                },
            };
            const mockRestoreResponse = {
                data: {
                    message: 'Version restored successfully',
                },
            };
            mockHttpClient.get.mockResolvedValueOnce(mockVersionHistory);
            mockHttpClient.post.mockResolvedValueOnce(mockRestoreResponse);
            const result = await versionOps.undoChanges({
                jobId: '1.0',
                path: '/content/test/page',
            });
            expect(result.success).toBe(true);
            expect(result.operation).toBe('undoChanges');
            expect(result.data.versionInfo).toBeDefined();
            expect(result.data.versionInfo?.restoredVersion).toBe('1.0');
        });
        it('should return fallback message when restore fails', async () => {
            mockHttpClient.get.mockRejectedValueOnce(new Error('Version not found'));
            const result = await versionOps.undoChanges({
                jobId: 'invalid-version',
                path: '/content/test/page',
            });
            expect(result.success).toBe(true);
            expect(result.data.message).toContain('undoChanges requires a valid path and version name');
        });
        it('should return fallback message for non-version jobId', async () => {
            const result = await versionOps.undoChanges({
                jobId: 'regular-job-id',
            });
            expect(result.success).toBe(true);
            expect(result.data.message).toContain('undoChanges requires a valid path and version name');
        });
    });
});
//# sourceMappingURL=version-operations.test.js.map
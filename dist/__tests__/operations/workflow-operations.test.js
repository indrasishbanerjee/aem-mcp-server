/**
 * Unit tests for WorkflowOperations
 */
import { WorkflowOperations } from '../../operations/workflow-operations.js';
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
describe('WorkflowOperations', () => {
    let workflowOps;
    beforeEach(() => {
        workflowOps = new WorkflowOperations(mockHttpClient, mockLogger, mockAEMConfig);
        jest.clearAllMocks();
    });
    describe('startWorkflow', () => {
        it('should start a workflow successfully', async () => {
            const mockResponse = {
                data: {
                    workflowId: 'workflow-123',
                    status: 'RUNNING',
                    model: '/var/workflow/models/test-model',
                    payloadPath: '/content/test',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const request = {
                model: '/var/workflow/models/test-model',
                payloadPath: '/content/test',
                title: 'Test Workflow',
                comment: 'Starting test workflow',
            };
            const result = await workflowOps.startWorkflow(request);
            expect(result.success).toBe(true);
            expect(result.operation).toBe('startWorkflow');
            expect(result.data.workflowId).toBe('workflow-123');
            expect(result.data.status).toBe('RUNNING');
            expect(mockHttpClient.post).toHaveBeenCalledWith('/bin/workflow/instances', expect.any(URLSearchParams), expect.objectContaining({
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }));
        });
        it('should handle workflow start failure', async () => {
            mockHttpClient.post.mockRejectedValueOnce(new Error('Workflow start failed'));
            const request = {
                model: '/var/workflow/models/test-model',
                payloadPath: '/content/test',
            };
            await expect(workflowOps.startWorkflow(request)).rejects.toThrow();
        });
        it('should validate required parameters', async () => {
            const request = {
                payloadPath: '/content/test',
                // Missing required 'model' parameter
            };
            await expect(workflowOps.startWorkflow(request)).rejects.toThrow();
        });
    });
    describe('getWorkflowStatus', () => {
        it('should get workflow status successfully', async () => {
            const mockResponse = {
                data: {
                    workflowId: 'workflow-123',
                    status: 'RUNNING',
                    currentStep: 'Review',
                    started: '2024-01-01T10:00:00Z',
                    model: '/var/workflow/models/test-model',
                    payloadPath: '/content/test',
                    history: [
                        {
                            step: 'Start',
                            status: 'COMPLETED',
                            timestamp: '2024-01-01T10:00:00Z',
                        },
                        {
                            step: 'Review',
                            status: 'RUNNING',
                            timestamp: '2024-01-01T10:05:00Z',
                        },
                    ],
                },
            };
            mockHttpClient.get.mockResolvedValueOnce(mockResponse);
            const result = await workflowOps.getWorkflowStatus('workflow-123');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('getWorkflowStatus');
            expect(result.data.workflowId).toBe('workflow-123');
            expect(result.data.status).toBe('RUNNING');
            expect(mockHttpClient.get).toHaveBeenCalledWith('/bin/workflow/instances/workflow-123.json');
        });
        it('should handle workflow not found', async () => {
            const mockError = {
                response: {
                    status: 404,
                    data: { message: 'Workflow not found' },
                },
            };
            mockHttpClient.get.mockRejectedValueOnce(mockError);
            await expect(workflowOps.getWorkflowStatus('nonexistent-workflow')).rejects.toThrow();
        });
    });
    describe('completeWorkflowStep', () => {
        it('should complete workflow step successfully', async () => {
            const mockResponse = {
                data: {
                    workflowId: 'workflow-123',
                    completedStep: 'Review',
                    nextStep: 'Approve',
                    status: 'RUNNING',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const result = await workflowOps.completeWorkflowStep('workflow-123', 'Review', 'Step completed');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('completeWorkflowStep');
            expect(result.data.workflowId).toBe('workflow-123');
            expect(result.data.completedStep).toBe('Review');
            expect(mockHttpClient.post).toHaveBeenCalledWith('/bin/workflow/instances/workflow-123/steps/Review', expect.any(URLSearchParams), expect.objectContaining({
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }));
        });
        it('should handle step completion failure', async () => {
            mockHttpClient.post.mockRejectedValueOnce(new Error('Step completion failed'));
            await expect(workflowOps.completeWorkflowStep('workflow-123', 'Review')).rejects.toThrow();
        });
    });
    describe('cancelWorkflow', () => {
        it('should cancel workflow successfully', async () => {
            const mockResponse = {
                data: {
                    workflowId: 'workflow-123',
                    status: 'CANCELLED',
                    cancelledAt: '2024-01-01T11:00:00Z',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const result = await workflowOps.cancelWorkflow('workflow-123', 'Workflow cancelled by user');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('cancelWorkflow');
            expect(result.data.workflowId).toBe('workflow-123');
            expect(result.data.status).toBe('CANCELLED');
            expect(mockHttpClient.post).toHaveBeenCalledWith('/bin/workflow/instances/workflow-123/cancel', expect.any(URLSearchParams), expect.objectContaining({
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }));
        });
    });
    describe('listActiveWorkflows', () => {
        it('should list active workflows successfully', async () => {
            const mockResponse = {
                data: {
                    workflows: [
                        {
                            workflowId: 'workflow-123',
                            status: 'RUNNING',
                            model: '/var/workflow/models/test-model',
                            payloadPath: '/content/test',
                            started: '2024-01-01T10:00:00Z',
                        },
                        {
                            workflowId: 'workflow-456',
                            status: 'RUNNING',
                            model: '/var/workflow/models/approval-model',
                            payloadPath: '/content/page',
                            started: '2024-01-01T09:30:00Z',
                        },
                    ],
                    totalCount: 2,
                },
            };
            mockHttpClient.get.mockResolvedValueOnce(mockResponse);
            const result = await workflowOps.listActiveWorkflows(10);
            expect(result.success).toBe(true);
            expect(result.operation).toBe('listActiveWorkflows');
            expect(result.data.workflows).toHaveLength(2);
            expect(result.data.totalCount).toBe(2);
            expect(mockHttpClient.get).toHaveBeenCalledWith('/bin/workflow/instances.json', expect.objectContaining({
                params: { limit: 10, status: 'RUNNING' },
            }));
        });
        it('should use default limit when not specified', async () => {
            const mockResponse = { data: { workflows: [], totalCount: 0 } };
            mockHttpClient.get.mockResolvedValueOnce(mockResponse);
            await workflowOps.listActiveWorkflows();
            expect(mockHttpClient.get).toHaveBeenCalledWith('/bin/workflow/instances.json', expect.objectContaining({
                params: { limit: 20, status: 'RUNNING' },
            }));
        });
    });
    describe('suspendWorkflow', () => {
        it('should suspend workflow successfully', async () => {
            const mockResponse = {
                data: {
                    workflowId: 'workflow-123',
                    status: 'SUSPENDED',
                    suspendedAt: '2024-01-01T11:00:00Z',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const result = await workflowOps.suspendWorkflow('workflow-123', 'Workflow suspended for review');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('suspendWorkflow');
            expect(result.data.workflowId).toBe('workflow-123');
            expect(result.data.status).toBe('SUSPENDED');
        });
    });
    describe('resumeWorkflow', () => {
        it('should resume workflow successfully', async () => {
            const mockResponse = {
                data: {
                    workflowId: 'workflow-123',
                    status: 'RUNNING',
                    resumedAt: '2024-01-01T12:00:00Z',
                },
            };
            mockHttpClient.post.mockResolvedValueOnce(mockResponse);
            const result = await workflowOps.resumeWorkflow('workflow-123');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('resumeWorkflow');
            expect(result.data.workflowId).toBe('workflow-123');
            expect(result.data.status).toBe('RUNNING');
        });
    });
    describe('getWorkflowModels', () => {
        it('should get workflow models successfully', async () => {
            const mockResponse = {
                data: {
                    models: [
                        {
                            id: '/var/workflow/models/test-model',
                            title: 'Test Workflow Model',
                            description: 'A test workflow model',
                            version: '1.0',
                        },
                        {
                            id: '/var/workflow/models/approval-model',
                            title: 'Approval Workflow Model',
                            description: 'An approval workflow model',
                            version: '1.2',
                        },
                    ],
                },
            };
            mockHttpClient.get.mockResolvedValueOnce(mockResponse);
            const result = await workflowOps.getWorkflowModels();
            expect(result.success).toBe(true);
            expect(result.operation).toBe('getWorkflowModels');
            expect(result.data.models).toHaveLength(2);
            expect(mockHttpClient.get).toHaveBeenCalledWith('/bin/workflow/models.json');
        });
    });
});
//# sourceMappingURL=workflow-operations.test.js.map
/**
 * Workflow Operations Module
 * Handles all AEM workflow-related operations including start, status, complete, and cancel
 */
import { createAEMError, handleAEMHttpError, safeExecute, createSuccessResponse, AEM_ERROR_CODES } from '../error-handler.js';
export class WorkflowOperations {
    httpClient;
    logger;
    config;
    constructor(httpClient, logger, config) {
        this.httpClient = httpClient;
        this.logger = logger;
        this.config = config;
    }
    /**
     * Start a new workflow instance
     */
    async startWorkflow(request) {
        return safeExecute(async () => {
            const { model, payloadPath, title, comment } = request;
            if (!model || !payloadPath) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Model and payload path are required', { model, payloadPath });
            }
            // Validate payload path exists
            try {
                await this.httpClient.get(`${payloadPath}.json`);
            }
            catch (error) {
                if (error.response?.status === 404) {
                    throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Payload path not found: ${payloadPath}`, { payloadPath });
                }
                throw handleAEMHttpError(error, 'startWorkflow');
            }
            // Start workflow using AEM's workflow API
            const workflowData = {
                model: model,
                payload: payloadPath,
                title: title || `Workflow for ${payloadPath}`,
                comment: comment || 'Started via AEM MCP Server'
            };
            const response = await this.httpClient.post('/etc/workflow/instances', workflowData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            // Extract workflow ID from response
            const workflowId = this.extractWorkflowId(response.data);
            if (!workflowId) {
                throw createAEMError(AEM_ERROR_CODES.SYSTEM_ERROR, 'Failed to extract workflow ID from response', { response: response.data });
            }
            return createSuccessResponse({
                workflowId,
                model,
                payloadPath,
                title: workflowData.title,
                comment: workflowData.comment,
                status: 'RUNNING',
                createdBy: 'admin', // In real implementation, get from auth context
                createdAt: new Date().toISOString()
            }, 'startWorkflow');
        }, 'startWorkflow');
    }
    /**
     * Get workflow status by ID
     */
    async getWorkflowStatus(workflowId) {
        return safeExecute(async () => {
            if (!workflowId) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Workflow ID is required', { workflowId });
            }
            try {
                // Get workflow instance details
                const response = await this.httpClient.get(`/etc/workflow/instances/${workflowId}.json`);
                const workflowData = response.data;
                // Parse workflow status and steps
                const status = this.mapWorkflowStatus(workflowData.state);
                const steps = this.parseWorkflowSteps(workflowData.history || []);
                const currentStep = this.getCurrentStep(steps);
                const progress = this.calculateProgress(steps);
                return createSuccessResponse({
                    workflowId,
                    status,
                    currentStep,
                    progress,
                    startedBy: workflowData.startedBy || 'admin',
                    startedAt: workflowData.startedAt || new Date().toISOString(),
                    completedAt: status === 'COMPLETED' ? workflowData.completedAt : undefined,
                    steps
                }, 'getWorkflowStatus');
            }
            catch (error) {
                if (error.response?.status === 404) {
                    throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, `Workflow not found: ${workflowId}`, { workflowId });
                }
                throw handleAEMHttpError(error, 'getWorkflowStatus');
            }
        }, 'getWorkflowStatus');
    }
    /**
     * Complete a workflow step
     */
    async completeWorkflowStep(workflowId, stepName, comment) {
        return safeExecute(async () => {
            if (!workflowId || !stepName) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Workflow ID and step name are required', { workflowId, stepName });
            }
            // Complete the workflow step
            const stepData = {
                action: 'complete',
                comment: comment || `Step ${stepName} completed via AEM MCP Server`
            };
            const response = await this.httpClient.post(`/etc/workflow/instances/${workflowId}/steps/${stepName}`, stepData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return createSuccessResponse({
                workflowId,
                stepName,
                comment: stepData.comment,
                status: 'COMPLETED',
                completedAt: new Date().toISOString()
            }, 'completeWorkflowStep');
        }, 'completeWorkflowStep');
    }
    /**
     * Cancel a workflow instance
     */
    async cancelWorkflow(workflowId, reason) {
        return safeExecute(async () => {
            if (!workflowId) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Workflow ID is required', { workflowId });
            }
            // Cancel the workflow
            const cancelData = {
                action: 'abort',
                reason: reason || 'Cancelled via AEM MCP Server'
            };
            const response = await this.httpClient.post(`/etc/workflow/instances/${workflowId}`, cancelData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return createSuccessResponse({
                workflowId,
                reason: cancelData.reason,
                status: 'ABORTED',
                cancelledAt: new Date().toISOString()
            }, 'cancelWorkflow');
        }, 'cancelWorkflow');
    }
    /**
     * List active workflow instances
     */
    async listActiveWorkflows(limit = 20) {
        return safeExecute(async () => {
            try {
                // Query active workflows
                const response = await this.httpClient.get('/bin/querybuilder.json', {
                    params: {
                        type: 'cq:WorkflowInstance',
                        'property': 'state',
                        'property.value': 'RUNNING',
                        'p.limit': limit.toString(),
                        'p.hits': 'full'
                    }
                });
                const workflows = (response.data.hits || []).map((hit) => ({
                    workflowId: hit.path?.split('/').pop() || hit.name,
                    model: hit['jcr:content/model'] || hit.model,
                    payloadPath: hit['jcr:content/payload'] || hit.payload,
                    status: hit['jcr:content/state'] || hit.state,
                    startedBy: hit['jcr:content/startedBy'] || hit.startedBy,
                    startedAt: hit['jcr:content/startedAt'] || hit.startedAt,
                    currentStep: hit['jcr:content/currentStep'] || hit.currentStep,
                    progress: this.calculateProgressFromHit(hit)
                }));
                return createSuccessResponse({
                    workflows,
                    totalCount: workflows.length,
                    activeCount: workflows.length,
                    completedCount: 0,
                    failedCount: 0
                }, 'listActiveWorkflows');
            }
            catch (error) {
                throw handleAEMHttpError(error, 'listActiveWorkflows');
            }
        }, 'listActiveWorkflows');
    }
    /**
     * Get all available workflow models
     */
    async getWorkflowModels() {
        return safeExecute(async () => {
            try {
                // Get workflow models from AEM
                const response = await this.httpClient.get('/etc/workflow/models.json', {
                    params: { ':depth': '3' }
                });
                const models = [];
                if (response.data && typeof response.data === 'object') {
                    Object.entries(response.data).forEach(([key, value]) => {
                        if (key.startsWith('jcr:') || key.startsWith('sling:'))
                            return;
                        if (value && typeof value === 'object') {
                            const modelPath = `/etc/workflow/models/${key}`;
                            const modelData = value['jcr:content'] || value;
                            models.push({
                                modelId: key,
                                title: modelData['jcr:title'] || key,
                                description: modelData['jcr:description'] || '',
                                version: modelData['version'] || '1.0',
                                status: modelData['status'] || 'enabled',
                                createdBy: modelData['jcr:createdBy'] || 'admin',
                                createdAt: modelData['jcr:created'] || new Date().toISOString(),
                                steps: this.parseModelSteps(modelData)
                            });
                        }
                    });
                }
                return createSuccessResponse({
                    models,
                    totalCount: models.length
                }, 'getWorkflowModels');
            }
            catch (error) {
                throw handleAEMHttpError(error, 'getWorkflowModels');
            }
        }, 'getWorkflowModels');
    }
    /**
     * Suspend a workflow instance
     */
    async suspendWorkflow(workflowId, reason) {
        return safeExecute(async () => {
            if (!workflowId) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Workflow ID is required', { workflowId });
            }
            // Suspend the workflow
            const suspendData = {
                action: 'suspend',
                reason: reason || 'Suspended via AEM MCP Server'
            };
            const response = await this.httpClient.post(`/etc/workflow/instances/${workflowId}`, suspendData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return createSuccessResponse({
                workflowId,
                reason: suspendData.reason,
                status: 'SUSPENDED',
                suspendedAt: new Date().toISOString()
            }, 'suspendWorkflow');
        }, 'suspendWorkflow');
    }
    /**
     * Resume a suspended workflow instance
     */
    async resumeWorkflow(workflowId) {
        return safeExecute(async () => {
            if (!workflowId) {
                throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Workflow ID is required', { workflowId });
            }
            // Resume the workflow
            const resumeData = {
                action: 'resume'
            };
            const response = await this.httpClient.post(`/etc/workflow/instances/${workflowId}`, resumeData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return createSuccessResponse({
                workflowId,
                status: 'RUNNING',
                resumedAt: new Date().toISOString()
            }, 'resumeWorkflow');
        }, 'resumeWorkflow');
    }
    // Helper methods
    extractWorkflowId(responseData) {
        // Extract workflow ID from AEM response
        if (responseData && responseData.path) {
            return responseData.path.split('/').pop();
        }
        if (responseData && responseData.workflowId) {
            return responseData.workflowId;
        }
        return null;
    }
    mapWorkflowStatus(aemStatus) {
        switch (aemStatus?.toUpperCase()) {
            case 'RUNNING':
                return 'RUNNING';
            case 'COMPLETED':
                return 'COMPLETED';
            case 'SUSPENDED':
                return 'SUSPENDED';
            case 'ABORTED':
                return 'ABORTED';
            case 'FAILED':
                return 'FAILED';
            default:
                return 'RUNNING';
        }
    }
    parseWorkflowSteps(history) {
        return (history || []).map((step) => ({
            name: step.name || step.stepName,
            status: this.mapStepStatus(step.status),
            startedAt: step.startedAt,
            completedAt: step.completedAt,
            assignee: step.assignee,
            comment: step.comment
        }));
    }
    mapStepStatus(status) {
        switch (status?.toUpperCase()) {
            case 'PENDING':
                return 'PENDING';
            case 'ACTIVE':
                return 'ACTIVE';
            case 'COMPLETED':
                return 'COMPLETED';
            case 'FAILED':
                return 'FAILED';
            default:
                return 'PENDING';
        }
    }
    getCurrentStep(steps) {
        const activeStep = steps.find(step => step.status === 'ACTIVE');
        if (activeStep) {
            return activeStep.name;
        }
        const lastCompletedStep = steps.filter(step => step.status === 'COMPLETED').pop();
        return lastCompletedStep ? lastCompletedStep.name : 'Unknown';
    }
    calculateProgress(steps) {
        if (steps.length === 0)
            return 0;
        const completedSteps = steps.filter(step => step.status === 'COMPLETED').length;
        return Math.round((completedSteps / steps.length) * 100);
    }
    calculateProgressFromHit(hit) {
        // Calculate progress from query hit data
        const totalSteps = hit.totalSteps || 1;
        const completedSteps = hit.completedSteps || 0;
        return Math.round((completedSteps / totalSteps) * 100);
    }
    parseModelSteps(modelData) {
        const steps = [];
        if (modelData && modelData.nodes) {
            Object.entries(modelData.nodes).forEach(([key, value]) => {
                if (key.startsWith('jcr:') || key.startsWith('sling:'))
                    return;
                if (value && typeof value === 'object') {
                    steps.push({
                        name: key,
                        title: value['jcr:title'] || key,
                        type: value['jcr:primaryType'] || 'unknown',
                        description: value['jcr:description']
                    });
                }
            });
        }
        return steps;
    }
}
//# sourceMappingURL=workflow-operations.js.map
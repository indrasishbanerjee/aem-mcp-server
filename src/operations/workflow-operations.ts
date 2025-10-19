/**
 * Workflow Operations Module
 * Handles all AEM workflow-related operations including start, status, complete, and cancel
 */

import { AxiosInstance } from 'axios';
import { 
  IAEMConnector,
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

export interface WorkflowRequest {
  model: string;
  payloadPath: string;
  title?: string;
  comment?: string;
}

export interface WorkflowResponse {
  success: boolean;
  operation: string;
  timestamp: string;
  data: {
    workflowId: string;
    model: string;
    payloadPath: string;
    title?: string;
    comment?: string;
    status: string;
    createdBy: string;
    createdAt: string;
  };
}

export interface WorkflowStatusResponse {
  success: boolean;
  operation: string;
  timestamp: string;
  data: {
    workflowId: string;
    status: 'RUNNING' | 'COMPLETED' | 'SUSPENDED' | 'ABORTED' | 'FAILED';
    currentStep: string;
    progress: number;
    startedBy: string;
    startedAt: string;
    completedAt?: string;
    steps: Array<{
      name: string;
      status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
      startedAt?: string;
      completedAt?: string;
      assignee?: string;
      comment?: string;
    }>;
  };
}

export interface WorkflowListResponse {
  success: boolean;
  operation: string;
  timestamp: string;
  data: {
    workflows: Array<{
      workflowId: string;
      model: string;
      payloadPath: string;
      status: string;
      startedBy: string;
      startedAt: string;
      currentStep: string;
      progress: number;
    }>;
    totalCount: number;
    activeCount: number;
    completedCount: number;
    failedCount: number;
  };
}

export interface WorkflowModelResponse {
  success: boolean;
  operation: string;
  timestamp: string;
  data: {
    models: Array<{
      modelId: string;
      title: string;
      description: string;
      version: string;
      status: string;
      createdBy: string;
      createdAt: string;
      steps: Array<{
        name: string;
        title: string;
        type: string;
        description?: string;
      }>;
    }>;
    totalCount: number;
  };
}

export class WorkflowOperations {
  constructor(
    private httpClient: AxiosInstance,
    private logger: ILogger,
    private config: AEMConfig
  ) {}

  /**
   * Start a new workflow instance
   */
  async startWorkflow(request: WorkflowRequest): Promise<WorkflowResponse> {
    return safeExecute<WorkflowResponse>(async () => {
      const { model, payloadPath, title, comment } = request;
      
      if (!model || !payloadPath) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          'Model and payload path are required', 
          { model, payloadPath }
        );
      }

      // Validate payload path exists
      try {
        await this.httpClient.get(`${payloadPath}.json`);
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw createAEMError(
            AEM_ERROR_CODES.INVALID_PARAMETERS, 
            `Payload path not found: ${payloadPath}`, 
            { payloadPath }
          );
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
        throw createAEMError(
          AEM_ERROR_CODES.SYSTEM_ERROR, 
          'Failed to extract workflow ID from response', 
          { response: response.data }
        );
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
      }, 'startWorkflow') as WorkflowResponse;
    }, 'startWorkflow');
  }

  /**
   * Get workflow status by ID
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatusResponse> {
    return safeExecute<WorkflowStatusResponse>(async () => {
      if (!workflowId) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          'Workflow ID is required', 
          { workflowId }
        );
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
        }, 'getWorkflowStatus') as WorkflowStatusResponse;
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw createAEMError(
            AEM_ERROR_CODES.INVALID_PARAMETERS, 
            `Workflow not found: ${workflowId}`, 
            { workflowId }
          );
        }
        throw handleAEMHttpError(error, 'getWorkflowStatus');
      }
    }, 'getWorkflowStatus');
  }

  /**
   * Complete a workflow step
   */
  async completeWorkflowStep(workflowId: string, stepName: string, comment?: string): Promise<{
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
      workflowId: string;
      stepName: string;
      comment?: string;
      status: string;
      completedAt: string;
    };
  }> {
    return safeExecute(async () => {
      if (!workflowId || !stepName) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          'Workflow ID and step name are required', 
          { workflowId, stepName }
        );
      }

      // Complete the workflow step
      const stepData = {
        action: 'complete',
        comment: comment || `Step ${stepName} completed via AEM MCP Server`
      };

      const response = await this.httpClient.post(
        `/etc/workflow/instances/${workflowId}/steps/${stepName}`, 
        stepData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

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
  async cancelWorkflow(workflowId: string, reason?: string): Promise<{
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
      workflowId: string;
      reason?: string;
      status: string;
      cancelledAt: string;
    };
  }> {
    return safeExecute(async () => {
      if (!workflowId) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          'Workflow ID is required', 
          { workflowId }
        );
      }

      // Cancel the workflow
      const cancelData = {
        action: 'abort',
        reason: reason || 'Cancelled via AEM MCP Server'
      };

      const response = await this.httpClient.post(
        `/etc/workflow/instances/${workflowId}`, 
        cancelData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

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
  async listActiveWorkflows(limit = 20): Promise<WorkflowListResponse> {
    return safeExecute<WorkflowListResponse>(async () => {
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

        const workflows = (response.data.hits || []).map((hit: any) => ({
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
        }, 'listActiveWorkflows') as WorkflowListResponse;
      } catch (error: any) {
        throw handleAEMHttpError(error, 'listActiveWorkflows');
      }
    }, 'listActiveWorkflows');
  }

  /**
   * Get all available workflow models
   */
  async getWorkflowModels(): Promise<WorkflowModelResponse> {
    return safeExecute<WorkflowModelResponse>(async () => {
      try {
        // Get workflow models from AEM
        const response = await this.httpClient.get('/etc/workflow/models.json', {
          params: { ':depth': '3' }
        });

        const models: Array<{
          modelId: string;
          title: string;
          description: string;
          version: string;
          status: string;
          createdBy: string;
          createdAt: string;
          steps: Array<{
            name: string;
            title: string;
            type: string;
            description?: string;
          }>;
        }> = [];

        if (response.data && typeof response.data === 'object') {
          Object.entries(response.data).forEach(([key, value]: [string, any]) => {
            if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
            
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
        }, 'getWorkflowModels') as WorkflowModelResponse;
      } catch (error: any) {
        throw handleAEMHttpError(error, 'getWorkflowModels');
      }
    }, 'getWorkflowModels');
  }

  /**
   * Suspend a workflow instance
   */
  async suspendWorkflow(workflowId: string, reason?: string): Promise<{
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
      workflowId: string;
      reason?: string;
      status: string;
      suspendedAt: string;
    };
  }> {
    return safeExecute(async () => {
      if (!workflowId) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          'Workflow ID is required', 
          { workflowId }
        );
      }

      // Suspend the workflow
      const suspendData = {
        action: 'suspend',
        reason: reason || 'Suspended via AEM MCP Server'
      };

      const response = await this.httpClient.post(
        `/etc/workflow/instances/${workflowId}`, 
        suspendData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

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
  async resumeWorkflow(workflowId: string): Promise<{
    success: boolean;
    operation: string;
    timestamp: string;
    data: {
      workflowId: string;
      status: string;
      resumedAt: string;
    };
  }> {
    return safeExecute(async () => {
      if (!workflowId) {
        throw createAEMError(
          AEM_ERROR_CODES.INVALID_PARAMETERS, 
          'Workflow ID is required', 
          { workflowId }
        );
      }

      // Resume the workflow
      const resumeData = {
        action: 'resume'
      };

      const response = await this.httpClient.post(
        `/etc/workflow/instances/${workflowId}`, 
        resumeData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return createSuccessResponse({
        workflowId,
        status: 'RUNNING',
        resumedAt: new Date().toISOString()
      }, 'resumeWorkflow');
    }, 'resumeWorkflow');
  }

  // Helper methods
  private extractWorkflowId(responseData: any): string | null {
    // Extract workflow ID from AEM response
    if (responseData && responseData.path) {
      return responseData.path.split('/').pop();
    }
    if (responseData && responseData.workflowId) {
      return responseData.workflowId;
    }
    return null;
  }

  private mapWorkflowStatus(aemStatus: string): 'RUNNING' | 'COMPLETED' | 'SUSPENDED' | 'ABORTED' | 'FAILED' {
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

  private parseWorkflowSteps(history: any[]): Array<{
    name: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
    startedAt?: string;
    completedAt?: string;
    assignee?: string;
    comment?: string;
  }> {
    return (history || []).map((step: any) => ({
      name: step.name || step.stepName,
      status: this.mapStepStatus(step.status),
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      assignee: step.assignee,
      comment: step.comment
    }));
  }

  private mapStepStatus(status: string): 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' {
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

  private getCurrentStep(steps: any[]): string {
    const activeStep = steps.find(step => step.status === 'ACTIVE');
    if (activeStep) {
      return activeStep.name;
    }
    
    const lastCompletedStep = steps.filter(step => step.status === 'COMPLETED').pop();
    return lastCompletedStep ? lastCompletedStep.name : 'Unknown';
  }

  private calculateProgress(steps: any[]): number {
    if (steps.length === 0) return 0;
    
    const completedSteps = steps.filter(step => step.status === 'COMPLETED').length;
    return Math.round((completedSteps / steps.length) * 100);
  }

  private calculateProgressFromHit(hit: any): number {
    // Calculate progress from query hit data
    const totalSteps = hit.totalSteps || 1;
    const completedSteps = hit.completedSteps || 0;
    return Math.round((completedSteps / totalSteps) * 100);
  }

  private parseModelSteps(modelData: any): Array<{
    name: string;
    title: string;
    type: string;
    description?: string;
  }> {
    const steps: Array<{
      name: string;
      title: string;
      type: string;
      description?: string;
    }> = [];

    if (modelData && modelData.nodes) {
      Object.entries(modelData.nodes).forEach(([key, value]: [string, any]) => {
        if (key.startsWith('jcr:') || key.startsWith('sling:')) return;
        
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

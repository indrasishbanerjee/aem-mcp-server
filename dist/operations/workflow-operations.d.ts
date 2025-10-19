/**
 * Workflow Operations Module
 * Handles all AEM workflow-related operations including start, status, complete, and cancel
 */
import { AxiosInstance } from 'axios';
import { ILogger, AEMConfig } from '../interfaces/index.js';
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
export declare class WorkflowOperations {
    private httpClient;
    private logger;
    private config;
    constructor(httpClient: AxiosInstance, logger: ILogger, config: AEMConfig);
    /**
     * Start a new workflow instance
     */
    startWorkflow(request: WorkflowRequest): Promise<WorkflowResponse>;
    /**
     * Get workflow status by ID
     */
    getWorkflowStatus(workflowId: string): Promise<WorkflowStatusResponse>;
    /**
     * Complete a workflow step
     */
    completeWorkflowStep(workflowId: string, stepName: string, comment?: string): Promise<{
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
    }>;
    /**
     * Cancel a workflow instance
     */
    cancelWorkflow(workflowId: string, reason?: string): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            workflowId: string;
            reason?: string;
            status: string;
            cancelledAt: string;
        };
    }>;
    /**
     * List active workflow instances
     */
    listActiveWorkflows(limit?: number): Promise<WorkflowListResponse>;
    /**
     * Get all available workflow models
     */
    getWorkflowModels(): Promise<WorkflowModelResponse>;
    /**
     * Suspend a workflow instance
     */
    suspendWorkflow(workflowId: string, reason?: string): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            workflowId: string;
            reason?: string;
            status: string;
            suspendedAt: string;
        };
    }>;
    /**
     * Resume a suspended workflow instance
     */
    resumeWorkflow(workflowId: string): Promise<{
        success: boolean;
        operation: string;
        timestamp: string;
        data: {
            workflowId: string;
            status: string;
            resumedAt: string;
        };
    }>;
    private extractWorkflowId;
    private mapWorkflowStatus;
    private parseWorkflowSteps;
    private mapStepStatus;
    private getCurrentStep;
    private calculateProgress;
    private calculateProgressFromHit;
    private parseModelSteps;
}
//# sourceMappingURL=workflow-operations.d.ts.map
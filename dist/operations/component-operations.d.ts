/**
 * Component Operations Module
 * Handles all AEM component-related operations including CRUD, validation, and bulk updates
 */
import { AxiosInstance } from 'axios';
import { IAEMConnector, CreateComponentRequest, UpdateComponentRequest, DeleteComponentRequest, ValidateComponentRequest, BulkUpdateComponentsRequest, ComponentResponse, UpdateResponse, DeleteResponse, ValidateResponse, ScanComponentsResponse, BulkUpdateResponse, ILogger, AEMConfig } from '../interfaces/index.js';
export declare class ComponentOperations implements Partial<IAEMConnector> {
    private httpClient;
    private logger;
    private config;
    constructor(httpClient: AxiosInstance, logger: ILogger, config: AEMConfig);
    /**
     * Create a new component on a page
     */
    createComponent(request: CreateComponentRequest): Promise<ComponentResponse>;
    /**
     * Update component properties in AEM
     */
    updateComponent(request: UpdateComponentRequest): Promise<UpdateResponse>;
    /**
     * Delete a component from AEM
     */
    deleteComponent(request: DeleteComponentRequest): Promise<DeleteResponse>;
    /**
     * Validate component changes before applying them
     */
    validateComponent(request: ValidateComponentRequest): Promise<ValidateResponse>;
    /**
     * Scan a page to discover all components and their properties
     */
    scanPageComponents(pagePath: string): Promise<ScanComponentsResponse>;
    /**
     * Update multiple components in a single operation with validation and rollback support
     */
    bulkUpdateComponents(request: BulkUpdateComponentsRequest): Promise<BulkUpdateResponse>;
    /**
     * Update the image path for an image component and verify the update
     */
    updateImagePath(componentPath: string, newImagePath: string): Promise<UpdateResponse>;
    /**
     * Validate component properties based on component type
     */
    private validateComponentProps;
}
//# sourceMappingURL=component-operations.d.ts.map
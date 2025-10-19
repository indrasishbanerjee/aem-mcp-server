export interface AEMErrorDetails {
    [key: string]: any;
}
export declare class AEMOperationError extends Error {
    code: string;
    details?: AEMErrorDetails;
    recoverable?: boolean;
    retryAfter?: number;
    constructor(error: {
        code: string;
        message: string;
        details?: AEMErrorDetails;
        recoverable?: boolean;
        retryAfter?: number;
    });
}
export declare const AEM_ERROR_CODES: {
    readonly CONNECTION_FAILED: "CONNECTION_FAILED";
    readonly TIMEOUT: "TIMEOUT";
    readonly AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly INVALID_PATH: "INVALID_PATH";
    readonly INVALID_COMPONENT_TYPE: "INVALID_COMPONENT_TYPE";
    readonly INVALID_LOCALE: "INVALID_LOCALE";
    readonly INVALID_PARAMETERS: "INVALID_PARAMETERS";
    readonly RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND";
    readonly COMPONENT_NOT_FOUND: "COMPONENT_NOT_FOUND";
    readonly PAGE_NOT_FOUND: "PAGE_NOT_FOUND";
    readonly UPDATE_FAILED: "UPDATE_FAILED";
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    readonly REPLICATION_FAILED: "REPLICATION_FAILED";
    readonly QUERY_FAILED: "QUERY_FAILED";
    readonly INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
    readonly SYSTEM_ERROR: "SYSTEM_ERROR";
    readonly RATE_LIMITED: "RATE_LIMITED";
};
export declare function createAEMError(code: string, message: string, details?: AEMErrorDetails, recoverable?: boolean, retryAfter?: number): AEMOperationError;
export declare function handleAEMHttpError(error: any, operation: string): AEMOperationError;
export declare function safeExecute<T>(operation: () => Promise<T>, operationName: string, maxRetries?: number): Promise<T>;
export declare function validateComponentOperation(locale: string, pagePath: string, component: string, props: any): void;
export declare function createSuccessResponse<T>(data: T, operation: string): {
    success: boolean;
    operation: string;
    timestamp: string;
    data: T;
};
export declare function createErrorResponse(error: AEMOperationError, operation: string): {
    success: boolean;
    operation: string;
    timestamp: string;
    error: {
        code: string;
        message: string;
        details: AEMErrorDetails | undefined;
        recoverable: boolean | undefined;
        retryAfter: number | undefined;
    };
};
export declare function isValidContentPath(path: string, config?: any): boolean;
export declare function isValidComponentType(componentType: string): boolean;
//# sourceMappingURL=error-handler.d.ts.map
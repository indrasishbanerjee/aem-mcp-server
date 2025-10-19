export interface AEMErrorDetails {
  [key: string]: any;
}

export class AEMOperationError extends Error {
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
  }) {
    super(error.message);
    this.name = 'AEMOperationError';
    this.code = error.code;
    this.details = error.details;
    this.recoverable = error.recoverable;
    this.retryAfter = error.retryAfter;
  }
}

export const AEM_ERROR_CODES = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_PATH: 'INVALID_PATH',
  INVALID_COMPONENT_TYPE: 'INVALID_COMPONENT_TYPE',
  INVALID_LOCALE: 'INVALID_LOCALE',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  COMPONENT_NOT_FOUND: 'COMPONENT_NOT_FOUND',
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
  UPDATE_FAILED: 'UPDATE_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  REPLICATION_FAILED: 'REPLICATION_FAILED',
  QUERY_FAILED: 'QUERY_FAILED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export function createAEMError(
  code: string,
  message: string,
  details?: AEMErrorDetails,
  recoverable = false,
  retryAfter?: number
): AEMOperationError {
  return new AEMOperationError({ code, message, details, recoverable, retryAfter });
}

export function handleAEMHttpError(error: any, operation: string): AEMOperationError {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    switch (status) {
      case 401:
        return createAEMError(AEM_ERROR_CODES.AUTHENTICATION_FAILED, 'Authentication failed. Check AEM credentials.', { status, data });
      case 403:
        return createAEMError(AEM_ERROR_CODES.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions for this operation.', { status, data, operation });
      case 404:
        return createAEMError(AEM_ERROR_CODES.RESOURCE_NOT_FOUND, 'Resource not found in AEM.', { status, data, operation });
      case 429:
        const retryAfter = error.response.headers['retry-after'];
        return createAEMError(AEM_ERROR_CODES.RATE_LIMITED, 'Rate limit exceeded. Please try again later.', { status, data }, true, retryAfter ? parseInt(retryAfter) * 1000 : 60000);
      case 500:
      case 502:
      case 503:
        return createAEMError(AEM_ERROR_CODES.SYSTEM_ERROR, 'AEM system error. Please try again later.', { status, data }, true, 30000);
      default:
        return createAEMError(AEM_ERROR_CODES.SYSTEM_ERROR, `HTTP ${status}: ${data?.message || 'Unknown error'}`, { status, data, operation });
    }
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return createAEMError(AEM_ERROR_CODES.CONNECTION_FAILED, 'Cannot connect to AEM instance. Check host and network.', { originalError: error.message }, true, 5000);
  } else if (error.code === 'ETIMEDOUT') {
    return createAEMError(AEM_ERROR_CODES.TIMEOUT, 'Request to AEM timed out.', { originalError: error.message }, true, 10000);
  } else {
    return createAEMError(AEM_ERROR_CODES.SYSTEM_ERROR, `Unexpected error during ${operation}: ${error.message}`, { originalError: error.message });
  }
}

export async function safeExecute<T>(operation: () => Promise<T>, operationName: string, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error instanceof AEMOperationError
        ? error
        : handleAEMHttpError(error, operationName);
      if (!lastError.recoverable || attempt === maxRetries) {
        break;
      }
      const delay = lastError.retryAfter || Math.pow(2, attempt) * 1000;
      // eslint-disable-next-line no-console
      console.warn(`[${operationName}] Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export function validateComponentOperation(locale: string, pagePath: string, component: string, props: any): void {
  const errors: string[] = [];
  if (!locale || typeof locale !== 'string') {
    errors.push('Locale is required and must be a string');
  }
  if (!pagePath || typeof pagePath !== 'string') {
    errors.push('Page path is required and must be a string');
  } else if (!pagePath.startsWith('/content')) {
    errors.push('Page path must start with /content');
  }
  if (!component || typeof component !== 'string') {
    errors.push('Component type is required and must be a string');
  }
  if (!props || typeof props !== 'object') {
    errors.push('Component properties are required and must be an object');
  }
  if (errors.length > 0) {
    throw createAEMError(AEM_ERROR_CODES.INVALID_PARAMETERS, 'Invalid component operation parameters', { errors });
  }
}

export function createSuccessResponse<T>(data: T, operation: string) {
  return {
    success: true,
    operation,
    timestamp: new Date().toISOString(),
    data
  };
}

export function createErrorResponse(error: AEMOperationError, operation: string) {
  return {
    success: false,
    operation,
    timestamp: new Date().toISOString(),
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      recoverable: error.recoverable,
      retryAfter: error.retryAfter
    }
  };
}

export function isValidContentPath(path: string, config?: any): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }
  // Basic validation - should start with /content
  return path.startsWith('/content');
}

export function isValidComponentType(componentType: string): boolean {
  if (!componentType || typeof componentType !== 'string') {
    return false;
  }
  // Basic validation - should be a valid component path
  return componentType.startsWith('/') || componentType.includes('/');
} 
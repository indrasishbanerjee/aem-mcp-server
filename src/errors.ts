export const AEM_ERROR_CODES = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  INVALID_PATH: 'INVALID_PATH',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CSRF_FAILED: 'CSRF_FAILED',
  TOOL_DISABLED: 'TOOL_DISABLED',
  POLICY_DENIED: 'POLICY_DENIED',
  QUERY_FAILED: 'QUERY_FAILED',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE'
} as const;

export type AemErrorCode = (typeof AEM_ERROR_CODES)[keyof typeof AEM_ERROR_CODES];

export class AemError extends Error {
  readonly code: AemErrorCode;
  readonly details?: Record<string, unknown>;
  readonly recoverable: boolean;
  readonly statusCode: number;
  readonly retryAfterMs?: number;

  constructor(options: {
    code: AemErrorCode;
    message: string;
    details?: Record<string, unknown>;
    recoverable?: boolean;
    statusCode?: number;
    retryAfterMs?: number;
  }) {
    super(options.message);
    this.name = 'AemError';
    this.code = options.code;
    this.details = options.details;
    this.recoverable = options.recoverable ?? false;
    this.statusCode = options.statusCode ?? 500;
    this.retryAfterMs = options.retryAfterMs;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      retryAfterMs: this.retryAfterMs
    };
  }
}

export function isAemError(error: unknown): error is AemError {
  return error instanceof AemError;
}

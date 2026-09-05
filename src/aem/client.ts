import http from 'node:http';
import https from 'node:https';
import axios, { AxiosInstance, AxiosError } from 'axios';
import type { AppConfig } from '../config.js';
import { AEM_ERROR_CODES, AemError, isAemError } from '../errors.js';
import type { Logger } from '../logger.js';
import { WriteSemaphore } from './semaphore.js';
import { CircuitBreaker } from './circuit-breaker.js';

const PROTECTED_PROPERTIES = new Set([
  'jcr:uuid',
  'jcr:created',
  'jcr:createdBy',
  'jcr:mixinTypes',
  'jcr:primaryType',
  'cq:template',
  'sling:resourceType'
]);

export class AemHttpClient {
  private readonly http: AxiosInstance;
  private csrfToken?: string;
  private csrfFetchedAt = 0;
  private readonly writes: WriteSemaphore;
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    httpClient?: AxiosInstance
  ) {
    this.writes = new WriteSemaphore(config.aem.maxConcurrentWrites);
    this.breaker = new CircuitBreaker();
    this.http =
      httpClient ??
      axios.create({
        baseURL: config.aem.host,
        timeout: config.aem.timeoutMs,
        auth: {
          username: config.aem.username,
          password: config.aem.password
        },
        httpAgent: new http.Agent({ keepAlive: true, maxSockets: 16 }),
        httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 16 }),
        maxContentLength: config.aem.maxUploadBytes,
        maxBodyLength: config.aem.maxUploadBytes,
        validateStatus: status => status < 400,
        headers: {
          Accept: 'application/json, text/html;q=0.8, */*;q=0.5'
        }
      });
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    this.breaker.assertClosed();
    try {
      const response = await this.http.get<T>(path, { params });
      this.breaker.recordSuccess();
      return response.data;
    } catch (error) {
      this.breaker.recordFailure();
      throw this.mapError(error, 'GET', path);
    }
  }

  async postForm<T = unknown>(path: string, fields: Record<string, string>): Promise<T> {
    return this.mutating('POST', path, async token => {
      const body = new URLSearchParams();
      body.set('_charset_', 'UTF-8');
      for (const [key, value] of Object.entries(fields)) {
        body.set(key, value);
      }
      const response = await this.http.post<T>(path, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'CSRF-Token': token
        }
      });
      return response.data;
    });
  }

  async postMultipart<T = unknown>(path: string, form: FormData): Promise<T> {
    return this.mutating('POST', path, async token => {
      const response = await this.http.post<T>(path, form, {
        headers: {
          'CSRF-Token': token
        },
        timeout: Math.max(this.config.aem.timeoutMs, 120000)
      });
      return response.data;
    });
  }

  filterWritableProperties(
    properties: Record<string, unknown>,
    options: { allowResourceType?: boolean; allowPrimaryType?: boolean } | boolean = {}
  ): Record<string, string> {
    const opts = typeof options === 'boolean' ? { allowResourceType: options } : options;
    const writable: Record<string, string> = {};
    for (const [key, value] of Object.entries(properties)) {
      const allowedException =
        (opts.allowResourceType && key === 'sling:resourceType') ||
        (opts.allowPrimaryType && key === 'jcr:primaryType');
      if (PROTECTED_PROPERTIES.has(key) && !allowedException) {
        continue;
      }
      if (value === null || value === undefined) {
        writable[`${key}@Delete`] = '';
        continue;
      }
      if (Array.isArray(value)) {
        writable[`${key}`] = value.map(item => String(item)).join(',');
        writable[`${key}@TypeHint`] = 'String[]';
        continue;
      }
      if (typeof value === 'object') {
        throw new AemError({
          code: AEM_ERROR_CODES.INVALID_PARAMETERS,
          message: `Nested object property '${key}' is not supported; use Sling field names`,
          statusCode: 400
        });
      }
      writable[key] = String(value);
    }
    return writable;
  }

  private async mutating<T>(
    method: string,
    path: string,
    exec: (token: string) => Promise<T>
  ): Promise<T> {
    this.breaker.assertClosed();
    return this.writes.run(async () => {
      const token = await this.ensureCsrf();
      try {
        const result = await exec(token);
        this.breaker.recordSuccess();
        return result;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          this.csrfToken = undefined;
          const retryToken = await this.ensureCsrf();
          try {
            const retried = await exec(retryToken);
            this.breaker.recordSuccess();
            return retried;
          } catch (retryError) {
            this.breaker.recordFailure();
            throw this.mapError(retryError, method, path, true);
          }
        }
        this.breaker.recordFailure();
        throw this.mapError(error, method, path);
      }
    });
  }

  private async ensureCsrf(): Promise<string> {
    const fresh = this.csrfToken && Date.now() - this.csrfFetchedAt < 5 * 60 * 1000;
    if (fresh && this.csrfToken) {
      return this.csrfToken;
    }
    try {
      const response = await this.http.get<unknown>('/libs/granite/csrf/token.json');
      const token = extractCsrfToken(response.data);
      if (!token) {
        throw new AemError({
          code: AEM_ERROR_CODES.CSRF_FAILED,
          message: 'AEM CSRF token endpoint did not return a token',
          statusCode: 502
        });
      }
      this.csrfToken = token;
      this.csrfFetchedAt = Date.now();
      return token;
    } catch (error) {
      throw this.mapError(error, 'GET', '/libs/granite/csrf/token.json');
    }
  }

  private mapError(error: unknown, method: string, path: string, csrfRetry = false): AemError {
    if (isAemError(error)) {
      return error;
    }
    if (!axios.isAxiosError(error)) {
      return new AemError({
        code: AEM_ERROR_CODES.SYSTEM_ERROR,
        message: error instanceof Error ? error.message : 'Unexpected AEM client error',
        details: { method, path }
      });
    }
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    this.logger.warn('AEM request failed', { method, path, status, csrfRetry });
    if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
      return new AemError({
        code: AEM_ERROR_CODES.CONNECTION_FAILED,
        message: 'Cannot connect to AEM Author',
        recoverable: true,
        statusCode: 503,
        details: { method, path }
      });
    }
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new AemError({
        code: AEM_ERROR_CODES.TIMEOUT,
        message: 'AEM request timed out',
        recoverable: true,
        statusCode: 504,
        details: { method, path }
      });
    }
    if (status === 401) {
      return new AemError({
        code: AEM_ERROR_CODES.AUTHENTICATION_FAILED,
        message: 'AEM rejected the technical user credentials',
        statusCode: 401
      });
    }
    if (status === 403) {
      return new AemError({
        code: csrfRetry ? AEM_ERROR_CODES.CSRF_FAILED : AEM_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        message: csrfRetry
          ? 'AEM CSRF validation failed after retry'
          : 'Insufficient AEM permissions for this operation',
        statusCode: 403,
        details: { method, path }
      });
    }
    if (status === 404) {
      return new AemError({
        code: AEM_ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'AEM resource not found',
        statusCode: 404,
        details: { method, path }
      });
    }
    if (status === 409) {
      return new AemError({
        code: AEM_ERROR_CODES.CONFLICT,
        message: 'AEM reported a conflict for this path',
        statusCode: 409,
        details: { method, path }
      });
    }
    if (status === 413) {
      return new AemError({
        code: AEM_ERROR_CODES.PAYLOAD_TOO_LARGE,
        message: 'Upload exceeds AEM or client size limits',
        statusCode: 413
      });
    }
    return new AemError({
      code: AEM_ERROR_CODES.SYSTEM_ERROR,
      message: `AEM HTTP ${status ?? 'error'} during ${method} ${path}`,
      statusCode: status && status >= 400 ? status : 502,
      details: { method, path }
    });
  }
}

function extractCsrfToken(data: unknown): string | undefined {
  if (typeof data === 'string' && data.trim()) {
    return data.trim();
  }
  if (
    data &&
    typeof data === 'object' &&
    'token' in data &&
    typeof (data as { token: unknown }).token === 'string'
  ) {
    return (data as { token: string }).token;
  }
  return undefined;
}

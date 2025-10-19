/**
 * HTTP Client Module
 * Creates and configures axios instances for AEM communication
 */
import { AxiosInstance } from 'axios';
import { IConfig } from './interfaces/index.js';
/**
 * Create an axios instance configured for AEM communication
 */
export declare function createAxiosInstance(config: IConfig): AxiosInstance;
/**
 * Create a specialized axios instance for file uploads
 */
export declare function createUploadAxiosInstance(config: IConfig): AxiosInstance;
/**
 * Create a specialized axios instance for streaming operations
 */
export declare function createStreamingAxiosInstance(config: IConfig): AxiosInstance;
//# sourceMappingURL=http-client.d.ts.map
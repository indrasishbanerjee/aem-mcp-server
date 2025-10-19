/**
 * HTTP Client Module
 * Creates and configures axios instances for AEM communication
 */
import axios from 'axios';
/**
 * Create an axios instance configured for AEM communication
 */
export function createAxiosInstance(config) {
    const axiosConfig = {
        baseURL: config.aem.host,
        timeout: config.aem.queries.timeoutMs,
        auth: {
            username: config.aem.serviceUser.username,
            password: config.aem.serviceUser.password,
        },
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    };
    const instance = axios.create(axiosConfig);
    // Add request interceptor for logging
    instance.interceptors.request.use((config) => {
        // Log request details
        console.log(`Making request to: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
    }, (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    });
    // Add response interceptor for logging and error handling
    instance.interceptors.response.use((response) => {
        // Log successful responses
        console.log(`Response received: ${response.status} ${response.config.url}`);
        return response;
    }, (error) => {
        // Log error responses
        console.error(`Request failed: ${error.response?.status} ${error.config?.url}`, {
            message: error.message,
            data: error.response?.data
        });
        return Promise.reject(error);
    });
    return instance;
}
/**
 * Create a specialized axios instance for file uploads
 */
export function createUploadAxiosInstance(config) {
    const axiosConfig = {
        baseURL: config.aem.host,
        timeout: 60000, // Longer timeout for uploads
        auth: {
            username: config.aem.serviceUser.username,
            password: config.aem.serviceUser.password,
        },
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        maxContentLength: 100 * 1024 * 1024, // 100MB max file size
        maxBodyLength: 100 * 1024 * 1024,
    };
    return axios.create(axiosConfig);
}
/**
 * Create a specialized axios instance for streaming operations
 */
export function createStreamingAxiosInstance(config) {
    const axiosConfig = {
        baseURL: config.aem.host,
        timeout: 0, // No timeout for streaming
        auth: {
            username: config.aem.serviceUser.username,
            password: config.aem.serviceUser.password,
        },
        headers: {
            'Accept': 'application/json',
        },
        responseType: 'stream',
    };
    return axios.create(axiosConfig);
}
//# sourceMappingURL=http-client.js.map
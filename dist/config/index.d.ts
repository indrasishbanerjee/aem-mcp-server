/**
 * Configuration Management Module
 * Handles environment variables, configuration validation, and multiple environment support
 */
import { IConfig } from '../interfaces/index.js';
/**
 * Load configuration from environment variables with validation
 */
export declare function loadConfig(): IConfig;
/**
 * Get configuration for a specific environment
 */
export declare function getEnvironmentConfig(environment: 'development' | 'staging' | 'production'): IConfig;
/**
 * Check if running in development mode
 */
export declare function isDevelopment(): boolean;
/**
 * Check if running in production mode
 */
export declare function isProduction(): boolean;
/**
 * Get the current environment
 */
export declare function getEnvironment(): 'development' | 'staging' | 'production';
//# sourceMappingURL=index.d.ts.map
/**
 * Configuration Management Module
 * Handles environment variables, configuration validation, and multiple environment support
 */
/**
 * Load configuration from environment variables with validation
 */
export function loadConfig() {
    const config = {
        aem: loadAEMConfig(),
        mcp: loadMCPConfig(),
        server: loadServerConfig(),
        security: loadSecurityConfig(),
        logging: loadLoggingConfig(),
    };
    // Validate configuration
    validateConfig(config);
    return config;
}
/**
 * Load AEM-specific configuration
 */
function loadAEMConfig() {
    return {
        host: process.env.AEM_HOST || 'http://localhost:4502',
        author: process.env.AEM_AUTHOR || process.env.AEM_HOST || 'http://localhost:4502',
        publish: process.env.AEM_PUBLISH || 'http://localhost:4503',
        serviceUser: {
            username: process.env.AEM_SERVICE_USER || 'admin',
            password: process.env.AEM_SERVICE_PASSWORD || 'admin',
        },
        endpoints: {
            content: '/content',
            dam: '/content/dam',
            query: '/bin/querybuilder.json',
            crxde: '/crx/de',
            jcr: '',
            replicate: '/bin/replicate.json',
            wcmcommand: '/bin/wcmcommand',
        },
        contentPaths: {
            sitesRoot: process.env.AEM_SITES_ROOT || '/content',
            assetsRoot: process.env.AEM_ASSETS_ROOT || '/content/dam',
            templatesRoot: process.env.AEM_TEMPLATES_ROOT || '/conf',
            experienceFragmentsRoot: process.env.AEM_XF_ROOT || '/content/experience-fragments',
        },
        replication: {
            publisherUrls: process.env.AEM_PUBLISHER_URLS?.split(',') || ['http://localhost:4503'],
            defaultReplicationAgent: process.env.AEM_DEFAULT_AGENT || 'publish',
        },
        components: {
            allowedTypes: process.env.AEM_ALLOWED_COMPONENTS?.split(',') || [
                'text', 'image', 'hero', 'button', 'list', 'teaser', 'carousel'
            ],
            defaultProperties: {
                'jcr:primaryType': 'nt:unstructured',
                'sling:resourceType': 'foundation/components/text'
            },
        },
        queries: {
            maxLimit: parseInt(process.env.AEM_QUERY_MAX_LIMIT || '100', 10),
            defaultLimit: parseInt(process.env.AEM_QUERY_DEFAULT_LIMIT || '20', 10),
            timeoutMs: parseInt(process.env.AEM_QUERY_TIMEOUT || '30000', 10),
        },
        validation: {
            maxDepth: parseInt(process.env.AEM_MAX_DEPTH || '5', 10),
            allowedLocales: process.env.AEM_ALLOWED_LOCALES?.split(',') || ['en'],
        },
    };
}
/**
 * Load MCP-specific configuration
 */
function loadMCPConfig() {
    return {
        name: 'AEM MCP Server',
        version: process.env.npm_package_version || '1.0.0',
        port: parseInt(process.env.MCP_PORT || '8080', 10),
        gatewayPort: parseInt(process.env.GATEWAY_PORT || '3001', 10),
        username: process.env.MCP_USERNAME,
        password: process.env.MCP_PASSWORD,
    };
}
/**
 * Load server configuration
 */
function loadServerConfig() {
    return {
        port: parseInt(process.env.PORT || '3001', 10),
        host: process.env.HOST || 'localhost',
        cors: {
            enabled: process.env.CORS_ENABLED !== 'false',
            origins: process.env.CORS_ORIGINS?.split(',') || ['*'],
        },
        rateLimit: {
            enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
            maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        },
    };
}
/**
 * Load security configuration
 */
function loadSecurityConfig() {
    return {
        auth: {
            enabled: process.env.AUTH_ENABLED !== 'false',
            type: process.env.AUTH_TYPE || 'basic',
            jwtSecret: process.env.JWT_SECRET,
            apiKeyHeader: process.env.API_KEY_HEADER || 'x-api-key',
        },
        cors: {
            enabled: process.env.CORS_ENABLED !== 'false',
            origins: process.env.CORS_ORIGINS?.split(',') || ['*'],
            credentials: process.env.CORS_CREDENTIALS === 'true',
        },
        headers: {
            enabled: process.env.SECURITY_HEADERS_ENABLED !== 'false',
            hsts: process.env.HSTS_ENABLED !== 'false',
            noSniff: process.env.NO_SNIFF_ENABLED !== 'false',
            xssProtection: process.env.XSS_PROTECTION_ENABLED !== 'false',
        },
    };
}
/**
 * Load logging configuration
 */
function loadLoggingConfig() {
    return {
        level: process.env.LOG_LEVEL || 'info',
        enableConsole: process.env.LOG_CONSOLE_ENABLED !== 'false',
        enableFile: process.env.LOG_FILE_ENABLED !== 'false',
        logDirectory: process.env.LOG_DIRECTORY || './logs',
        maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760', 10), // 10MB
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
        enableStructuredLogging: process.env.STRUCTURED_LOGGING === 'true',
        enableCorrelation: process.env.LOG_CORRELATION_ENABLED !== 'false',
    };
}
/**
 * Validate configuration and throw errors for invalid values
 */
function validateConfig(config) {
    const errors = [];
    // Validate AEM configuration
    if (!config.aem.host) {
        errors.push('AEM_HOST is required');
    }
    if (!config.aem.serviceUser.username) {
        errors.push('AEM_SERVICE_USER is required');
    }
    if (!config.aem.serviceUser.password) {
        errors.push('AEM_SERVICE_PASSWORD is required');
    }
    if (config.aem.queries.maxLimit <= 0) {
        errors.push('AEM_QUERY_MAX_LIMIT must be greater than 0');
    }
    if (config.aem.queries.defaultLimit <= 0) {
        errors.push('AEM_QUERY_DEFAULT_LIMIT must be greater than 0');
    }
    if (config.aem.queries.timeoutMs <= 0) {
        errors.push('AEM_QUERY_TIMEOUT must be greater than 0');
    }
    if (config.aem.validation.maxDepth <= 0) {
        errors.push('AEM_MAX_DEPTH must be greater than 0');
    }
    // Validate server configuration
    if (config.server.port <= 0 || config.server.port > 65535) {
        errors.push('PORT must be between 1 and 65535');
    }
    if (config.mcp.port <= 0 || config.mcp.port > 65535) {
        errors.push('MCP_PORT must be between 1 and 65535');
    }
    if (config.mcp.gatewayPort <= 0 || config.mcp.gatewayPort > 65535) {
        errors.push('GATEWAY_PORT must be between 1 and 65535');
    }
    // Validate security configuration
    if (config.security.auth.enabled && !config.security.auth.type) {
        errors.push('AUTH_TYPE is required when authentication is enabled');
    }
    if (config.security.auth.type === 'jwt' && !config.security.auth.jwtSecret) {
        errors.push('JWT_SECRET is required when using JWT authentication');
    }
    // Validate logging configuration
    if (config.logging.maxFileSize <= 0) {
        errors.push('LOG_MAX_FILE_SIZE must be greater than 0');
    }
    if (config.logging.maxFiles <= 0) {
        errors.push('LOG_MAX_FILES must be greater than 0');
    }
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
}
/**
 * Get configuration for a specific environment
 */
export function getEnvironmentConfig(environment) {
    const baseConfig = loadConfig();
    switch (environment) {
        case 'development':
            return {
                ...baseConfig,
                logging: {
                    ...baseConfig.logging,
                    level: 'debug',
                    enableConsole: true,
                    enableFile: false,
                },
                security: {
                    ...baseConfig.security,
                    cors: {
                        ...baseConfig.security.cors,
                        origins: ['*'],
                    },
                },
            };
        case 'staging':
            return {
                ...baseConfig,
                logging: {
                    ...baseConfig.logging,
                    level: 'info',
                    enableConsole: true,
                    enableFile: true,
                },
                security: {
                    ...baseConfig.security,
                    cors: {
                        ...baseConfig.security.cors,
                        origins: process.env.CORS_ORIGINS?.split(',') || ['*'],
                    },
                },
            };
        case 'production':
            return {
                ...baseConfig,
                logging: {
                    ...baseConfig.logging,
                    level: 'warn',
                    enableConsole: false,
                    enableFile: true,
                    enableStructuredLogging: true,
                },
                security: {
                    ...baseConfig.security,
                    auth: {
                        ...baseConfig.security.auth,
                        enabled: true,
                    },
                    headers: {
                        ...baseConfig.security.headers,
                        enabled: true,
                        hsts: true,
                        noSniff: true,
                        xssProtection: true,
                    },
                },
            };
        default:
            return baseConfig;
    }
}
/**
 * Check if running in development mode
 */
export function isDevelopment() {
    return process.env.NODE_ENV === 'development';
}
/**
 * Check if running in production mode
 */
export function isProduction() {
    return process.env.NODE_ENV === 'production';
}
/**
 * Get the current environment
 */
export function getEnvironment() {
    const env = process.env.NODE_ENV;
    if (env === 'development' || env === 'staging' || env === 'production') {
        return env;
    }
    return 'development';
}
//# sourceMappingURL=index.js.map
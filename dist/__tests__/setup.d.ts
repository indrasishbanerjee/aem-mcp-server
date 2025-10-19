/**
 * Test Setup Configuration
 * Configures Jest for unit testing with mocks and utilities
 */
export declare const mockLogger: {
    error: any;
    warn: any;
    info: any;
    debug: any;
    trace: any;
    methodStart: any;
    methodEnd: any;
    methodError: any;
    httpRequest: any;
    aemOperation: any;
    performance: any;
    security: any;
    health: any;
};
export declare const mockConfig: {
    aem: {
        host: string;
        author: string;
        publish: string;
        serviceUser: {
            username: string;
            password: string;
        };
        endpoints: {
            content: string;
            dam: string;
            query: string;
            crxde: string;
            jcr: string;
            replicate: string;
            wcmcommand: string;
        };
        contentPaths: {
            sitesRoot: string;
            assetsRoot: string;
            templatesRoot: string;
            experienceFragmentsRoot: string;
        };
        replication: {
            publisherUrls: string[];
            defaultReplicationAgent: string;
        };
        components: {
            allowedTypes: string[];
            defaultProperties: {
                'jcr:primaryType': string;
                'sling:resourceType': string;
            };
        };
        queries: {
            maxLimit: number;
            defaultLimit: number;
            timeoutMs: number;
        };
        validation: {
            maxDepth: number;
            allowedLocales: string[];
        };
    };
    mcp: {
        name: string;
        version: string;
        port: number;
        gatewayPort: number;
    };
    server: {
        port: number;
        host: string;
        cors: {
            enabled: boolean;
            origins: string[];
        };
        rateLimit: {
            enabled: boolean;
            windowMs: number;
            maxRequests: number;
        };
    };
    security: {
        auth: {
            enabled: boolean;
            type: "basic";
        };
        cors: {
            enabled: boolean;
            origins: string[];
            credentials: boolean;
        };
        headers: {
            enabled: boolean;
            hsts: boolean;
            noSniff: boolean;
            xssProtection: boolean;
        };
    };
    logging: {
        level: "info";
        enableConsole: boolean;
        enableFile: boolean;
        logDirectory: string;
        maxFileSize: number;
        maxFiles: number;
        enableStructuredLogging: boolean;
        enableCorrelation: boolean;
    };
};
export declare const mockHttpClient: {
    get: any;
    post: any;
    put: any;
    delete: any;
    interceptors: {
        request: {
            use: any;
        };
        response: {
            use: any;
        };
    };
};
export declare const createMockResponse: (data: any, status?: number) => {
    data: any;
    status: number;
    statusText: string;
    headers: {};
    config: {};
};
export declare const createMockError: (message: string, status?: number) => any;
export declare const mockAEMResponses: {
    pageContent: {
        'jcr:content': {
            'jcr:title': string;
            'jcr:description': string;
            'cq:template': string;
            'sling:resourceType': string;
            'cq:lastModified': string;
            'cq:lastModifiedBy': string;
        };
    };
    pageList: {
        hits: {
            path: string;
            'jcr:content/jcr:title': string;
            'jcr:content/cq:template': string;
            'jcr:content/cq:lastModified': string;
        }[];
        total: number;
    };
    templates: {
        template1: {
            'jcr:content': {
                'jcr:title': string;
                'jcr:description': string;
                status: string;
                ranking: number;
            };
        };
        template2: {
            'jcr:content': {
                'jcr:title': string;
                'jcr:description': string;
                status: string;
                ranking: number;
            };
        };
    };
    componentContent: {
        'jcr:primaryType': string;
        'sling:resourceType': string;
        text: string;
    };
    assetMetadata: {
        'jcr:content': {
            metadata: {
                'dc:title': string;
                'dc:description': string;
                'dc:creator': string;
            };
        };
    };
};
//# sourceMappingURL=setup.d.ts.map
export interface AEMConfig {
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
        defaultProperties: Record<string, any>;
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
    siteName?: string;
    strictReplication?: boolean;
}
export declare const DEFAULT_AEM_CONFIG: AEMConfig;
export declare function getAEMConfig(): AEMConfig;
export declare function isValidContentPath(path: string, config?: AEMConfig): boolean;
export declare function isValidComponentType(componentType: string, config?: AEMConfig): boolean;
export declare function isValidLocale(locale: string, config?: AEMConfig): boolean;
//# sourceMappingURL=aem-config.d.ts.map
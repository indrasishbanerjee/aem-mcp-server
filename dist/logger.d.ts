export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: string;
    method?: string;
    requestId?: string;
    userId?: string;
    duration?: number;
    error?: any;
    metadata?: Record<string, any>;
}
export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    logDirectory: string;
    maxFileSize: number;
    maxFiles: number;
    enableStructuredLogging: boolean;
    enableCorrelation: boolean;
}
export declare class Logger {
    private config;
    private logFilePath;
    private errorFilePath;
    private correlationMap;
    constructor(config?: Partial<LoggerConfig>);
    private shouldLog;
    private formatMessage;
    private writeToFile;
    private writeToConsole;
    private log;
    error(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void;
    warn(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void;
    info(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void;
    debug(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void;
    trace(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void;
    methodStart(method: string, parameters: any, requestId?: string): void;
    methodEnd(method: string, duration: number, success: boolean, requestId?: string, result?: any): void;
    methodError(method: string, error: any, duration: number, requestId?: string, parameters?: any): void;
    httpRequest(method: string, url: string, statusCode: number, duration: number, requestId?: string): void;
    aemOperation(operation: string, path: string, success: boolean, duration: number, requestId?: string, details?: any): void;
    setCorrelation(requestId: string, userId?: string): void;
    getCorrelation(requestId: string): string | undefined;
    clearCorrelation(requestId: string): void;
    performance(operation: string, duration: number, metadata?: Record<string, any>): void;
    security(event: string, details: Record<string, any>, requestId?: string): void;
    health(component: string, status: 'healthy' | 'degraded' | 'unhealthy', details?: Record<string, any>): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
    flush(): void;
    child(context: string): Logger;
}
export declare const logger: Logger;
export declare function generateRequestId(): string;
export declare function loggingMiddleware(req: any, res: any, next: any): void;
export default logger;
//# sourceMappingURL=logger.d.ts.map
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 4] = "TRACE";
})(LogLevel || (LogLevel = {}));
export class Logger {
    config;
    logFilePath;
    errorFilePath;
    correlationMap = new Map();
    constructor(config = {}) {
        this.config = {
            level: LogLevel.INFO,
            enableConsole: true,
            enableFile: true,
            logDirectory: join(process.cwd(), 'logs'),
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            enableStructuredLogging: true,
            enableCorrelation: true,
            ...config
        };
        // Ensure log directory exists
        if (this.config.enableFile && !existsSync(this.config.logDirectory)) {
            mkdirSync(this.config.logDirectory, { recursive: true });
        }
        const timestamp = new Date().toISOString().split('T')[0];
        this.logFilePath = join(this.config.logDirectory, `aem-mcp-${timestamp}.log`);
        this.errorFilePath = join(this.config.logDirectory, `aem-mcp-errors-${timestamp}.log`);
    }
    shouldLog(level) {
        return level <= this.config.level;
    }
    formatMessage(entry) {
        if (this.config.enableStructuredLogging) {
            return JSON.stringify(entry);
        }
        else {
            const levelName = LogLevel[entry.level];
            let message = `[${entry.timestamp}] ${levelName}`;
            if (entry.context) {
                message += ` [${entry.context}]`;
            }
            if (entry.method) {
                message += ` [${entry.method}]`;
            }
            if (entry.requestId) {
                message += ` [${entry.requestId}]`;
            }
            message += `: ${entry.message}`;
            if (entry.duration !== undefined) {
                message += ` (${entry.duration}ms)`;
            }
            if (entry.error) {
                message += `\n  Error: ${entry.error.message || entry.error}`;
                if (entry.error.stack) {
                    message += `\n  Stack: ${entry.error.stack}`;
                }
            }
            if (entry.metadata) {
                message += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
            }
            return message;
        }
    }
    writeToFile(entry) {
        if (!this.config.enableFile)
            return;
        try {
            const message = this.formatMessage(entry) + '\n';
            appendFileSync(this.logFilePath, message, 'utf8');
            // Also write errors to separate error log
            if (entry.level === LogLevel.ERROR) {
                appendFileSync(this.errorFilePath, message, 'utf8');
            }
            // TODO: Implement log rotation based on file size
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    writeToConsole(entry) {
        if (!this.config.enableConsole)
            return;
        const message = this.formatMessage(entry);
        switch (entry.level) {
            case LogLevel.ERROR:
                console.error(message);
                break;
            case LogLevel.WARN:
                console.warn(message);
                break;
            case LogLevel.DEBUG:
            case LogLevel.TRACE:
                console.debug(message);
                break;
            default:
                console.log(message);
        }
    }
    log(level, message, context) {
        if (!this.shouldLog(level))
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...context
        };
        this.writeToConsole(entry);
        this.writeToFile(entry);
    }
    error(message, context) {
        this.log(LogLevel.ERROR, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    trace(message, context) {
        this.log(LogLevel.TRACE, message, context);
    }
    // Method-specific logging helpers
    methodStart(method, parameters, requestId) {
        this.info(`Method started: ${method}`, {
            method,
            requestId,
            metadata: { parameters }
        });
    }
    methodEnd(method, duration, success, requestId, result) {
        const level = success ? LogLevel.INFO : LogLevel.ERROR;
        const message = `Method ${success ? 'completed' : 'failed'}: ${method}`;
        this.log(level, message, {
            method,
            requestId,
            duration,
            metadata: success ? { resultSize: JSON.stringify(result || {}).length } : undefined
        });
    }
    methodError(method, error, duration, requestId, parameters) {
        this.error(`Method error: ${method}`, {
            method,
            requestId,
            duration,
            error,
            metadata: { parameters }
        });
    }
    // HTTP request logging
    httpRequest(method, url, statusCode, duration, requestId) {
        const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
        this.log(level, `HTTP ${method} ${url} - ${statusCode}`, {
            context: 'HTTP',
            requestId,
            duration,
            metadata: { method, url, statusCode }
        });
    }
    // AEM-specific logging
    aemOperation(operation, path, success, duration, requestId, details) {
        const level = success ? LogLevel.INFO : LogLevel.ERROR;
        this.log(level, `AEM ${operation}: ${path} - ${success ? 'SUCCESS' : 'FAILED'}`, {
            context: 'AEM',
            requestId,
            duration,
            metadata: { operation, path, details }
        });
    }
    // Correlation ID management
    setCorrelation(requestId, userId) {
        if (this.config.enableCorrelation && userId) {
            this.correlationMap.set(requestId, userId);
        }
    }
    getCorrelation(requestId) {
        return this.correlationMap.get(requestId);
    }
    clearCorrelation(requestId) {
        this.correlationMap.delete(requestId);
    }
    // Performance monitoring
    performance(operation, duration, metadata) {
        const level = duration > 5000 ? LogLevel.WARN : LogLevel.INFO; // Warn if operation takes > 5s
        this.log(level, `Performance: ${operation} took ${duration}ms`, {
            context: 'PERFORMANCE',
            duration,
            metadata
        });
    }
    // Security logging
    security(event, details, requestId) {
        this.warn(`Security event: ${event}`, {
            context: 'SECURITY',
            requestId,
            metadata: details
        });
    }
    // System health logging
    health(component, status, details) {
        const level = status === 'healthy' ? LogLevel.INFO :
            status === 'degraded' ? LogLevel.WARN : LogLevel.ERROR;
        this.log(level, `Health check: ${component} is ${status}`, {
            context: 'HEALTH',
            metadata: { component, status, ...details }
        });
    }
    // Configuration and utility methods
    setLevel(level) {
        this.config.level = level;
        this.info(`Log level changed to ${LogLevel[level]}`);
    }
    getLevel() {
        return this.config.level;
    }
    flush() {
        // In a real implementation, this would flush any buffered logs
        this.info('Log flush requested');
    }
    // Create child logger with context
    child(context) {
        const childLogger = new Logger(this.config);
        // Override log method to include context
        const originalLog = childLogger.log.bind(childLogger);
        childLogger.log = (level, message, logContext) => {
            originalLog(level, message, { ...logContext, context });
        };
        return childLogger;
    }
}
// Global logger instance
export const logger = new Logger({
    level: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO,
    enableConsole: process.env.NODE_ENV !== 'test',
    enableFile: true,
    enableStructuredLogging: process.env.STRUCTURED_LOGGING === 'true'
});
// Request ID generator
export function generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
// Logging middleware for Express
export function loggingMiddleware(req, res, next) {
    const requestId = generateRequestId();
    const startTime = Date.now();
    req.requestId = requestId;
    req.logger = logger.child(`HTTP-${req.method}`);
    // Log request start
    logger.httpRequest(req.method, req.url, 0, 0, requestId);
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (...args) {
        const duration = Date.now() - startTime;
        logger.httpRequest(req.method, req.url, res.statusCode, duration, requestId);
        originalEnd.apply(res, args);
    };
    next();
}
export default logger;
//# sourceMappingURL=logger.js.map
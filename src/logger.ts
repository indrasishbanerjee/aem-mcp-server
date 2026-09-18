import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { redact } from './security/redact.js';

export type LogLevelName = 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LEVELS: Record<LogLevelName, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

export interface LoggerOptions {
  level: LogLevelName;
  enableConsole: boolean;
  enableFile: boolean;
  logDirectory: string;
}

export class Logger {
  constructor(private readonly options: LoggerOptions) {}

  error(message: string, metadata?: Record<string, unknown>): void {
    this.write('error', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.write('warn', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write('info', message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.write('debug', message, metadata);
  }

  private write(level: LogLevelName, message: string, metadata?: Record<string, unknown>): void {
    if (LEVELS[level] > LEVELS[this.options.level]) {
      return;
    }
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(metadata ? { metadata: redact(metadata) } : {})
    };
    const serialized = JSON.stringify(entry);
    if (this.options.enableConsole) {
      process.stderr.write(`${serialized}\n`);
    }
    if (this.options.enableFile) {
      void this.append(serialized).catch(() => undefined);
    }
  }

  private async append(line: string): Promise<void> {
    await mkdir(this.options.logDirectory, { recursive: true });
    const file = join(
      this.options.logDirectory,
      `aem-mcp-${new Date().toISOString().slice(0, 10)}.log`
    );
    await appendFile(file, `${line}\n`, 'utf8');
  }
}

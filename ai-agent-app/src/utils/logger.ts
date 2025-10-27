/**
 * Logging utility for structured logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private level: LogLevel;
  private context: string;

  constructor(context: string, level: LogLevel = 'info') {
    this.context = context;
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const logEntry: Record<string, any> = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
    };
    
    if (data) {
      logEntry.data = data;
    }

    // eslint-disable-next-line no-console
    console.info(JSON.stringify(logEntry));
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: unknown): void {
    const errorData =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error;

    this.log('error', message, errorData);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(context: string, level?: LogLevel): Logger {
  return new Logger(context, level);
}

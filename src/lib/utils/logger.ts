/**
 * Centralized logging utility with security and structured logging support
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security';

interface LogContext {
  [key: string]: any;
  error?: Error;
  stack?: string;
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
}

class Logger {
  private static instance: Logger;
  private isProduction: boolean;
  private requestIdCounter: number = 0;

  private constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private generateRequestId(): string {
    return `${Date.now()}-${this.requestIdCounter++}`;
  }

  private sanitizeContext(context: LogContext): Omit<LogContext, 'error' | 'stack'> & { error?: string; stack?: string } {
    const { error, stack, ...sanitized } = context;
    const result: any = { ...sanitized };

    if (error instanceof Error) {
      result.error = error.message;
      if (!this.isProduction) {
        result.stack = error.stack;
      }
    }

    return result;
  }

  private log(level: LogLevel, message: string, context: LogContext = {}) {
    const timestamp = new Date().toISOString();
    const requestId = context.requestId || this.generateRequestId();
    
    const logEntry: any = {
      timestamp,
      level,
      message,
      requestId,
      ...this.sanitizeContext(context),
    };
    
    // Handle error object properly
    if (context.error && context.error instanceof Error) {
      logEntry.error = context.error.message;
      if (!this.isProduction) {
        logEntry.stack = context.error.stack;
      }
    }

    // Stringify the log entry
    const logString = JSON.stringify(logEntry);
    
    // Route to appropriate console method
    switch (level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'security':
      case 'info':
      case 'debug':
      default:
        if (!this.isProduction || level !== 'debug') {
          console.log(logString);
        }
    }

    // In production, you might want to send logs to a logging service
    if (this.isProduction && level === 'error') {
      this.sendToMonitoringService(logEntry);
    }
  }

  debug(message: string, context: LogContext = {}) {
    if (!this.isProduction) {
      this.log('debug', message, context);
    }
  }

  info(message: string, context: LogContext = {}) {
    this.log('info', message, context);
  }

  warn(message: string, context: LogContext = {}) {
    this.log('warn', message, context);
  }

  error(message: string, context: LogContext = {}) {
    this.log('error', message, context);
  }

  security(eventType: string, context: Omit<LogContext, 'error'> = {}) {
    this.log('security', `Security Event: ${eventType}`, {
      ...context,
      eventType,
    } as LogContext);
  }

  private sendToMonitoringService(logEntry: any) {
    // Implement integration with your monitoring service (e.g., Sentry, Datadog)
    // This is a placeholder for actual implementation
    if (typeof window === 'undefined') {
      // Server-side monitoring
      // Example: Sentry.captureException(logEntry.error);
    } else {
      // Client-side monitoring
      // Example: window.Sentry?.captureException(logEntry.error);
    }
  }
}

export const logger = Logger.getInstance();

export function createRequestLogger(req: any) {
  const requestId = req.headers.get('x-request-id') || Logger.getInstance()['generateRequestId']();
  const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const path = req.nextUrl?.pathname || 'unknown';
  const method = req.method || 'unknown';

  return {
    requestId,
    log: (level: LogLevel, message: string, context: LogContext = {}) => {
      // Use the public methods instead of the private log method
      const logContext = {
        ...context,
        requestId,
        ip,
        userAgent,
        path,
        method,
      };
      
      switch (level) {
        case 'error':
          logger.error(message, logContext);
          break;
        case 'warn':
          logger.warn(message, logContext);
          break;
        case 'info':
          logger.info(message, logContext);
          break;
        case 'debug':
          logger.debug(message, logContext);
          break;
        case 'security':
          logger.security(message, logContext);
          break;
      }
    },
  };
}

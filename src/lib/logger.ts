/**
 * Centralized logging utility
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
  error?: Error;
  stack?: string;
}

class Logger {
  private static instance: Logger;
  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(level: LogLevel, message: string, context: LogContext = {}) {
    const timestamp = new Date().toISOString();
    const logEntry: any = {
      timestamp,
      level,
      message,
      ...context,
    };

    if (context.error instanceof Error) {
      logEntry.error = context.error.message;
      logEntry.stack = context.error.stack;
    }

    const logString = JSON.stringify(logEntry);
    
    switch (level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'info':
      default:
        console.log(logString);
    }
  }

  info(message: string, context: LogContext = {}) {
    this.log('info', message, context);
  }

  warn(message: string, context: LogContext = {}) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context: LogContext = {}) {
    this.log('error', message, { ...context, error });
  }
}

export const logger = Logger.getInstance();

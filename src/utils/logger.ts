// Simple logger implementation

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const log = (level: LogLevel, message: string, meta?: Record<string, any>) => {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, ...meta };
  
  if (process.env.NODE_ENV === 'production') {
    // In production, log as JSON for structured logging
    console.log(JSON.stringify(logEntry));
  } else {
    // In development, pretty print for better readability
    console[level](`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta || '');
  }
};

export const logger = {
  error: (message: string, meta?: Record<string, any>) => log('error', message, meta),
  warn: (message: string, meta?: Record<string, any>) => log('warn', message, meta),
  info: (message: string, meta?: Record<string, any>) => log('info', message, meta),
  debug: (message: string, meta?: Record<string, any>) => log('debug', message, meta),
};

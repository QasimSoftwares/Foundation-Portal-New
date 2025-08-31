import { NextRequest } from 'next/server';

interface SecurityEvent {
  type: 'rate_limit' | 'csrf_validation' | 'auth' | 'security';
  level: 'info' | 'warn' | 'error';
  message: string;
  path?: string;
  method?: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>) {
  const logEntry: SecurityEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    const { timestamp, level, type, message, ...rest } = logEntry;
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${type}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, rest);
    } else if (level === 'warn') {
      console.warn(logMessage, rest);
    } else {
      console.log(logMessage, rest);
    }
  }

  // TODO: In production, send to a logging service like Sentry, Datadog, etc.
  // if (process.env.NODE_ENV === 'production') {
  //   // Example: sendToLoggingService('security', logEntry);
  // }
}

export function logRateLimitEvent(
  request: NextRequest,
  isRateLimited: boolean,
  metadata: {
    key: string;
    limit: number;
    remaining: number;
    resetAt: number;
    rateLimiter: 'redis' | 'memory';
    [key: string]: unknown;
  }
) {
  const { pathname } = request.nextUrl;
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  logSecurityEvent({
    type: 'rate_limit',
    level: isRateLimited ? 'warn' : 'info',
    message: isRateLimited ? 'Rate limit exceeded' : 'Rate limit check',
    path: pathname,
    method: request.method,
    ip,
    userAgent,
    metadata: {
      ...metadata,
      isRateLimited,
    },
  });
}

export function logCSRFEvent(
  request: NextRequest,
  isValid: boolean,
  metadata: Record<string, unknown> = {}
) {
  const { pathname } = request.nextUrl;
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  logSecurityEvent({
    type: 'csrf_validation',
    level: isValid ? 'info' : 'warn',
    message: isValid ? 'CSRF token validated' : 'CSRF validation failed',
    path: pathname,
    method: request.method,
    ip,
    userAgent,
    metadata,
  });
}

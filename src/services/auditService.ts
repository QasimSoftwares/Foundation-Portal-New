import { createLogger, format, transports } from 'winston';
import { supabaseClient } from '@/lib/supabaseClient';
import { Request } from 'express';

const { combine, timestamp, json } = format;

// Create a logger instance
const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/auth-audit.log' })
  ]
});

export interface AuthEvent {
  event: string;
  userId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  timestamp?: string;
}

export interface RateLimitEvent extends Omit<AuthEvent, 'event'> {
  event: 'rate_limit_exceeded' | 'rate_limit_reset';
  metadata: {
    path?: string;
    method?: string;
    attempts?: number;
    backoff?: number;
    retryAfter?: number;
    [key: string]: unknown;
  };
}

export const logAuthEvent = async (
  event: string, 
  metadata: Record<string, unknown> = {},
  req?: any
): Promise<void> => {
  const logData: AuthEvent = {
    event,
    userId: metadata.userId as string,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers?.['user-agent'],
    metadata,
  };

  // Log to file/console
  logger.info(logData);

  // Also store in Supabase for querying
  try {
    const { error } = await supabaseClient
      .from('auth_audit_logs')
      .insert({
        event_type: event as string,
        user_id: logData.userId || null,
        ip_address: logData.ipAddress || '',
        user_agent: logData.userAgent || '',
        metadata: logData.metadata || {},
        created_at: new Date().toISOString()
      } as any);

    if (error) {
      logger.error('Failed to save audit log to Supabase', { error });
    }
  } catch (error) {
    logger.error('Error saving audit log', { error });
  }
};

// Helper functions for common audit events
export const auditEvents = {
  /**
   * Log rate limit exceeded event
   */
  rateLimitExceeded: async (
    identifier: { ip?: string; userId?: string; email?: string },
    metadata: {
      path?: string;
      method?: string;
      attempts: number;
      backoff: number;
      retryAfter: number;
      [key: string]: unknown;
    },
    req?: Request
  ) => {
    return logAuthEvent('rate_limit_exceeded', {
      ...identifier,
      ...metadata,
    }, req);
  },

  /**
   * Log rate limit reset event
   */
  rateLimitReset: async (
    identifier: { ip?: string; userId?: string; email?: string },
    metadata: { path?: string; method?: string } = {},
    req?: Request
  ) => {
    return logAuthEvent('rate_limit_reset', {
      ...identifier,
      ...metadata,
    }, req);
  },
  loginSuccess: (userId: string, metadata: Record<string, unknown> = {}, req?: any) =>
    logAuthEvent('login_success', { ...metadata, userId }, req),
  
  loginFailed: (email: string, error: string, metadata: Record<string, unknown> = {}, req?: any) =>
    logAuthEvent('login_failed', { ...metadata, email, error }, req),
  
  logout: (userId: string, metadata: Record<string, unknown> = {}, req?: any) =>
    logAuthEvent('logout', { ...metadata, userId }, req),
  
  tokenRefresh: (userId: string, metadata: Record<string, unknown> = {}, req?: any) =>
    logAuthEvent('token_refresh', { ...metadata, userId }, req),
  
  unauthorizedAccess: (userId: string | null, metadata: Record<string, unknown> = {}, req?: any) =>
    logAuthEvent('unauthorized_access', { ...metadata, userId }, req),
  
  roleChange: (userId: string, oldRole: string, newRole: string, metadata: Record<string, unknown> = {}, req?: any) =>
    logAuthEvent('role_change', { ...metadata, userId, oldRole, newRole }, req),
};

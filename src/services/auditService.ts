import { createClient } from '@supabase/supabase-js';
import type { Request } from 'express';

// Define types for the auth_audit_logs table
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Database = {
  public: {
    Tables: {
      auth_audit_logs: {
        Row: {
          id?: string;
          event_type: string;
          user_id: string | null;
          ip_address: string;
          user_agent: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          user_id?: string | null;
          ip_address: string;
          user_agent: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          user_id?: string | null;
          ip_address?: string;
          user_agent?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
    };
  };
};

// Create the base Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Type for Supabase error
interface SupabaseError extends Error {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

// Type for audit log entries
type AuditLogEntry = {
  event_type: string;
  user_id: string | null;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

// Type-safe wrapper for audit log operations
const auditLogClient = {
  async insert(log: Omit<AuditLogEntry, 'created_at'> & { created_at?: string }) {
    const logEntry = {
      ...log,
      created_at: log.created_at || new Date().toISOString()
    };

    try {
      // Using type assertion here to bypass TypeScript's type checking
      // since we know the structure matches our database
      const { error } = await (supabase
        .from('auth_audit_logs')
        .insert([logEntry]) as any);

      if (error) throw error;
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Simple logger that's compatible with Edge Runtime
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  const logEntry = { 
    level, 
    message, 
    timestamp,
    ...meta 
  };
  
  // In production, you might want to send logs to a remote service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send logs to your API endpoint
    // fetch('/api/logs', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(logEntry)
    // }).catch(() => {
    //   // Fallback to console if logging fails
    //   console[level](`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta);
    // });
    console[level](`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta);
  } else {
    // In development, just log to console with colors
    const colors = {
      error: '\x1b[31m', // red
      warn: '\x1b[33m',  // yellow
      info: '\x1b[36m',  // cyan
      debug: '\x1b[35m', // magenta
    };
    const reset = '\x1b[0m';
    console[level](`${colors[level]}[${timestamp}] ${level.toUpperCase()}: ${message}${reset}`, meta);
  }
};

// Simple logger methods
export const logger = {
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      log('debug', message, meta);
    }
  },
};

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

// Audit log type is now defined as AuditLogEntry above

export async function logAuthEvent(
  event: string, 
  metadata: Record<string, unknown> = {},
  req?: any
): Promise<void> {
  const timestamp = new Date().toISOString();
  const userId = metadata.userId as string | undefined;
  const ipAddress = req?.ip || req?.connection?.remoteAddress || '';
  const userAgent = req?.headers?.['user-agent'] || '';
  
  const logData = {
    event,
    userId,
    ipAddress,
    userAgent,
    metadata,
    timestamp
  } satisfies AuthEvent;

  // Log to console with string message and metadata
  logger.info(`Auth Event: ${event}`, { 
    userId,
    ipAddress,
    userAgent,
    ...metadata 
  });

    // Also store in Supabase for querying if not in Edge Runtime
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
    try {
      const { error } = await auditLogClient.insert({
        event_type: event,
        user_id: userId || null,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { ...metadata },
        created_at: timestamp
      });

      if (error) {
        const supabaseError = error as SupabaseError;
        // If the error is about the table not existing, log it and continue
        if (supabaseError.code === '42P01') { // 42P01 is the code for undefined_table
          logger.debug('auth_audit_logs table does not exist, skipping database log', {
            event,
            userId,
            ipAddress,
            userAgent
          });
        } else {
          logger.error('Failed to save audit log to Supabase', { 
            error: supabaseError.message,
            details: supabaseError.details
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error saving audit log', { error: errorMessage });
    }
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

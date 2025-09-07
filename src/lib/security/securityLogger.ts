import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export type SecurityEventType = 
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'token_refresh'
  | 'token_revoked'
  | 'password_changed'
  | 'session_revoked'
  | 'security_alert'
  | 'logout_failed';

export interface SecurityEvent {
  event_type: SecurityEventType;
  user_id?: string | null;
  ip?: string | null;
  ua_hash?: string | null;
  metadata?: Record<string, any>;
}

class SecurityLogger {
  private static instance: SecurityLogger;
  private supabase: ReturnType<typeof createClient>;
  private enabled: boolean = true;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  public static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  public async logEvent(event: SecurityEvent): Promise<void> {
    if (!this.enabled) return;

    try {
      const eventData: any = {
        event_type: event.event_type,
        user_id: event.user_id || null,
        ip: event.ip || null,
        ua_hash: event.ua_hash || null,
        metadata: event.metadata || {}
      };

      const { error } = await this.supabase
        .from('security_events')
        .insert(eventData);

      if (error) {
        const logError = new Error(`Failed to log security event: ${error.message}`);
        logger.error(logError.message, logError, { event });
      }
    } catch (error: any) {
      logger.error('Unexpected error in security logger', error, {
        stack: error.stack
      });
    }
  }

  // Convenience methods for common events
  public async logLoginSuccess(
    userId: string, 
    ip?: string, 
    userAgent?: string, 
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      event_type: 'login_success',
      user_id: userId,
      ip: ip || null,
      ua_hash: userAgent ? Buffer.from(userAgent).toString('base64').slice(0, 32) : null,
      metadata
    });
  }

  public async logLoginFailed(
    identifier: string, 
    reason: string, 
    ip?: string, 
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      event_type: 'login_failed',
      ip: ip || null,
      ua_hash: userAgent ? Buffer.from(userAgent).toString('base64').slice(0, 32) : null,
      metadata: { 
        identifier, 
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  public async logLogout(
    userId: string, 
    ip?: string, 
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      event_type: 'logout',
      user_id: userId,
      ip: ip || null,
      ua_hash: userAgent ? Buffer.from(userAgent).toString('base64').slice(0, 32) : null,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  public async logLogoutFailed(
    userId: string,
    reason: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      event_type: 'logout_failed',
      user_id: userId,
      ip: ip || null,
      ua_hash: userAgent ? Buffer.from(userAgent).toString('base64').slice(0, 32) : null,
      metadata: {
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  public async logTokenRefresh(userId: string, metadata?: Record<string, any>) {
    await this.logEvent({
      event_type: 'token_refresh',
      user_id: userId,
      metadata
    });
  }

  public async logTokenRevocation(userId: string, reason: string, metadata?: Record<string, any>) {
    await this.logEvent({
      event_type: 'token_revoked',
      user_id: userId,
      metadata: { ...metadata, reason }
    });
  }

  public async logPasswordChange(userId: string, ip?: string) {
    await this.logEvent({
      event_type: 'password_changed',
      user_id: userId,
      ip
    });
  }

  public async logSecurityAlert(userId: string | null, message: string, metadata?: Record<string, any>) {
    await this.logEvent({
      event_type: 'security_alert',
      user_id: userId,
      metadata: { message, ...metadata }
    });
  }

  // Enable/disable logging (useful for testing)
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

export const securityLogger = SecurityLogger.getInstance();

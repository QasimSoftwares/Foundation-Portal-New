import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface SecurityLogEntry {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

class SecurityLogger {
  private static instance: SecurityLogger;
  private supabase = createClientComponentClient();

  private constructor() {}

  public static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  public async log(entry: SecurityLogEntry): Promise<void> {
    try {
      const { error } = await this.supabase.from('security_logs').insert([
        {
          user_id: entry.userId,
          action: entry.action,
          entity_type: entry.entityType,
          entity_id: entry.entityId,
          metadata: entry.metadata || {},
          ip_address: entry.ip || 'unknown',
          user_agent: entry.userAgent || 'unknown',
        },
      ]);

      if (error) {
        console.error('Failed to log security event:', error);
      }
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }
}

export const securityLogger = SecurityLogger.getInstance();

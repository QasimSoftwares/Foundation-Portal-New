import { logger } from '@/lib/utils/logger';

interface SecurityEvent {
  type: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

export const securityLogger = {
  logEvent: async (event: SecurityEvent) => {
    const { type, userId, sessionId, ip, metadata = {} } = event;
    
    // Add common metadata
    const logData = {
      ...metadata,
      eventType: type,
      userId,
      sessionId,
      ip,
      timestamp: new Date().toISOString(),
    };

    try {
      // Log to console in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Security Event]', logData);
      }
      
      // TODO: In production, you might want to send this to a security monitoring service
      // await sendToSecurityMonitoringService(logData);
      
      // Also log using the standard logger
      logger.info(`Security Event: ${type}`, logData);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  },
  
  // Helper methods for common security events
  logLoginSuccess: (userId: string, sessionId: string, ip?: string, deviceInfo?: any) => 
    securityLogger.logEvent({
      type: 'login_success',
      userId,
      sessionId,
      ip,
      metadata: { deviceInfo },
    }),
    
  logLoginFailed: (userId: string, reason: string, ip?: string, metadata?: Record<string, any>) =>
    securityLogger.logEvent({
      type: 'login_failed',
      userId,
      ip,
      metadata: { reason, ...metadata },
    }),
    
  logSessionRevoked: (userId: string, sessionId: string, reason: string, ip?: string) =>
    securityLogger.logEvent({
      type: 'session_revoked',
      userId,
      sessionId,
      ip,
      metadata: { reason },
    }),
    
  logSuspiciousActivity: (userId: string, activity: string, metadata?: Record<string, any>) =>
    securityLogger.logEvent({
      type: 'suspicious_activity',
      userId,
      metadata: { activity, ...metadata },
    }),
};

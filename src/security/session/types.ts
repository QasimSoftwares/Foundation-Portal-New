import { User } from '@supabase/supabase-js';

export interface SessionUser extends User {
  role?: string;
  email_verified?: boolean;
}

export interface SessionData {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface SessionValidationResult {
  isValid: boolean;
  user: SessionUser | null;
  error?: {
    code: string;
    message: string;
  };
}

export interface RefreshResult {
  success: boolean;
  session?: SessionData;
  error?: {
    code: string;
    message: string;
  };
}

export interface SessionManagerConfig {
  accessTokenCookieName: string;
  refreshTokenCookieName: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
  cookieDomain?: string;
  secureCookies: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  
  /**
   * Maximum number of concurrent sessions allowed per user
   * @default 5
   */
  maxConcurrentSessions?: number;
  
  /**
   * Session inactivity timeout in seconds
   * After this period of inactivity, the session will be marked as expired
   * @default 30 days (30 * 24 * 60 * 60)
   */
  sessionInactivityTimeout?: number;
  
  /**
   * Absolute session lifetime in seconds
   * After this period, the session will expire regardless of activity
   * @default 90 days (90 * 24 * 60 * 60)
   */
  sessionAbsoluteTimeout?: number;
  
  /**
   * Whether to enable device fingerprinting
   * @default true
   */
  enableDeviceFingerprinting?: boolean;
  
  /**
   * Whether to enforce concurrent session limits
   * @default true
   */
  enforceSessionLimits?: boolean;
}

export interface WithSessionOptions {
  /**
   * If true, requires the user to be authenticated
   * @default true
   */
  requireAuth?: boolean;
  
  /**
   * Required user roles to access the route
   * If empty, any authenticated user can access
   */
  requiredRoles?: string[];
  
  /**
   * If true, requires the user to have a verified email
   * @default false
   */
  requireEmailVerified?: boolean;
  
  /**
   * Custom error handler for authentication/authorization failures
   */
  onError?: (error: { code: string; message: string }) => void;
}

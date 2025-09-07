// src/security/session/sessionManager.new.ts

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/supabase';
import { SessionError } from '@/lib/errors';

const DEFAULT_CONFIG = {
  accessTokenCookieName: 'sb-access-token' as string,
  refreshTokenCookieName: 'sb-refresh-token' as string,
  accessTokenMaxAge: 60 * 60, // 1 hour
  refreshTokenMaxAge: 60 * 60 * 24 * 7, // 7 days
  maxConcurrentSessions: 5,
};

type SessionManagerConfig = {
  accessTokenCookieName?: string;
  refreshTokenCookieName?: string;
  accessTokenMaxAge?: number;
  refreshTokenMaxAge?: number;
  maxConcurrentSessions?: number;
  secureCookies?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
};

type User = SupabaseUser;

export class SessionManager {
  private config: typeof DEFAULT_CONFIG & {
    secureCookies: boolean;
    sameSite: 'lax' | 'strict' | 'none';
  };
  private supabaseAdmin: SupabaseClient<Database>;

  constructor(config: SessionManagerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      secureCookies: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      ...config,
    } as const;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }

    this.supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  /**
   * Start a new user session using the RPC function
   */
  async startSession(params: {
    userId: string;
    session: Session;
    ip?: string | null;
    userAgent?: string | null;
    deviceId?: string | null;
    deviceInfo?: any;
  }): Promise<{ sessionId: string; refreshTokenId: string }> {
    const { userId, session, ip, userAgent, deviceId, deviceInfo } = params;
    const refresh = session.refresh_token;
  
    if (!refresh) {
      throw new Error('Missing refresh token in session');
    }
  
    try {
      // Call the RPC function and handle returned rows (PostgREST returns an array for table-returning functions)
      const { data, error } = await this.supabaseAdmin
        .rpc('create_user_session', {
          p_user_id: userId,
          p_refresh_token: refresh,
          p_ip: ip || null,
          p_user_agent: userAgent || null,
          p_device_id: deviceId || null,
          // Pass JSON objects directly for jsonb parameters
          p_device_info: deviceInfo ?? null,
        });
  
      if (error) {
        // Include richer error context from PostgREST/Supabase
        const enriched = typeof error === 'object' ? JSON.stringify(error) : String(error);
        throw new Error(`Failed to create session: ${error.message} | ${enriched}`);
      }
  
      // data is an array of rows; take the first result
      const rows = data as unknown as Array<
        { session_id?: string; refresh_token_id?: string; out_session_id?: string; out_refresh_token_id?: string }
      > | null;
      if (!rows || rows.length === 0) {
        throw new Error('No data returned from session creation');
      }
      const result = rows[0];

      const sessionId = result.out_session_id ?? result.session_id;
      const refreshTokenId = result.out_refresh_token_id ?? result.refresh_token_id;

      if (!sessionId || !refreshTokenId) {
        throw new Error('Invalid data returned from session creation');
      }

      return {
        sessionId,
        refreshTokenId,
      };
    } catch (error) {
      const errorContext = {
        userId,
        ip,
        userAgent,
        hasDeviceInfo: !!deviceInfo,
      };
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const sessionError = new SessionError(`Failed to start session: ${errorMessage}`, errorContext);
      
      // Log the error with context in the message
      logger.error(`${sessionError.message} | ${JSON.stringify(errorContext)}`, sessionError);
      
      throw sessionError;
    }
  }
  /**
   * Refresh a user session
   */
  async refreshSession(params: {
    oldRefreshToken: string;
    newRefreshToken: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<{ sessionId: string; refreshTokenId: string }> {
    try {
      const { data, error } = await this.supabaseAdmin.rpc('refresh_user_session', {
        p_old_refresh_token: params.oldRefreshToken,
        p_new_refresh_token: params.newRefreshToken,
        p_ip: params.ip || null,
        p_user_agent: params.userAgent || null,
      });

      if (error) {
        throw new Error(`Failed to refresh session: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from session refresh');
      }

      const result = data as unknown as { session_id: string; refresh_token_id: string };

      return {
        sessionId: result.session_id,
        refreshTokenId: result.refresh_token_id,
      };
    } catch (error) {
      const errorContext = {
        ip: params.ip,
        userAgent: params.userAgent,
      };
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const sessionError = new SessionError(`Failed to refresh session: ${errorMessage}`, errorContext);
      
      // Log the error with context in the message
      logger.error(`${sessionError.message} | ${JSON.stringify(errorContext)}`, sessionError);
      
      throw sessionError;
    }
  }

  /**
   * Revoke a session
   */
  async revokeSession(params: {
    sessionId: string;
    reason?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabaseAdmin.rpc('revoke_session', {
        p_session_id: params.sessionId,
        p_reason: params.reason || 'user_logout',
      });

      if (error) {
        throw new Error(`Failed to revoke session: ${error.message}`);
      }
    } catch (error) {
      const errorContext = {
        sessionId: params.sessionId,
        reason: params.reason
      };
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const sessionError = new SessionError(`Failed to revoke session: ${errorMessage}`, errorContext);
      
      // Log the error with context in the message
      logger.error(`${sessionError.message} | ${JSON.stringify(errorContext)}`, sessionError);
      
      throw sessionError;
    }
  }

  /**
   * Get the Supabase client
   */
  getSupabaseClient(): SupabaseClient<Database> {
    return this.supabaseAdmin;
  }

  /**
   * Get the access token cookie name
   */
  getAccessTokenCookieName(): string {
    return this.config.accessTokenCookieName;
  }

  /**
   * Get the refresh token cookie name
   */
  getRefreshTokenCookieName(): string {
    return this.config.refreshTokenCookieName;
  }

  /**
   * Get the access token max age
   */
  getAccessTokenMaxAge(): number {
    return this.config.accessTokenMaxAge;
  }

  /**
   * Get the refresh token max age
   */
  getRefreshTokenMaxAge(): number {
    return this.config.refreshTokenMaxAge;
  }

  /**
   * Get the secure cookies setting
   */
  getSecureCookies(): boolean {
    return this.config.secureCookies;
  }

  /**
   * Get the same site setting
   */
  getSameSite(): 'lax' | 'strict' | 'none' {
    return this.config.sameSite;
  }

  /**
   * Get the current user
   */
  async getUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await this.supabaseAdmin.auth.getUser();
      
      if (error) {
        throw new SessionError('Failed to get user', { error: error.message });
      }
      
      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get user: ${errorMessage}`);
      return null;
    }
  }
}

// Export a singleton instance
export const sessionManager = new SessionManager();

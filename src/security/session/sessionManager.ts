import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, type NextResponse } from 'next/server';
import { cookies as nextCookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';
import type { SessionData, SessionManagerConfig, SessionUser, SessionValidationResult, RefreshResult } from './types';

const DEFAULT_CONFIG: SessionManagerConfig = {
  accessTokenCookieName: 'sb-access-token',
  refreshTokenCookieName: 'sb-refresh-token',
  accessTokenMaxAge: 60 * 60, // 1 hour
  refreshTokenMaxAge: 60 * 60 * 24 * 7, // 7 days
  secureCookies: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
};

export class SessionManager {
  private config: SessionManagerConfig;
  
  constructor(config: Partial<SessionManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the Supabase client instance
   */
  getSupabaseClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );
  }

  /**
   * Get the user from the request
   */
  async getUser(req: NextRequest): Promise<SessionUser | null> {
    const supabase = this.getSupabaseClient();

    // Get access token cookie name
    const accessToken = req.cookies.get(this.getAccessTokenCookieName())?.value;
    const refreshToken = req.cookies.get(this.getRefreshTokenCookieName())?.value;

    if (!accessToken) return null;

    try {
      // Set the session for this request
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);

      if (error || !user) {
        // Try to refresh the session if we have a refresh token
        if (refreshToken) {
          const { session: newSession, error: refreshError } = await this.refreshSession(refreshToken);
          if (refreshError || !newSession) return null;
          return this.normalizeUser(newSession.user);
        }
        return null;
      }

      return this.normalizeUser(user);
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Validate the session and get the user
   */
  async validateSession(req: NextRequest): Promise<SessionValidationResult> {
    const user = await this.getUser(req);

    if (!user) {
      return {
        isValid: false,
        user: null,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'No valid session found',
        },
      };
    }

    return {
      isValid: true,
      user,
    };
  }

  /**
   * Refresh the session using a refresh token
   */
  async refreshSession(refreshToken: string): Promise<{ session: Session | null; error: any }> {
    const supabase = this.getSupabaseClient();

    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        return { session: null, error: error || new Error('No session returned') };
      }

      return { session: data.session, error: null };
    } catch (error) {
      console.error('Error refreshing session:', error);
      return { session: null, error };
    }
  }

  /**
   * Set session cookies in the response
   */
  setSessionCookies(res: NextResponse, session: Session): NextResponse {
    const { access_token, refresh_token } = session;
    if (!access_token || !refresh_token) return res;

    // Set access token cookie
    res.cookies.set({
      name: this.config.accessTokenCookieName,
      value: access_token,
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: this.config.sameSite,
      path: '/',
      maxAge: this.config.accessTokenMaxAge,
      ...(this.config.cookieDomain && { domain: this.config.cookieDomain }),
    });

    // Set refresh token cookie
    res.cookies.set({
      name: this.config.refreshTokenCookieName,
      value: refresh_token,
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: this.config.sameSite,
      path: '/',
      maxAge: this.config.refreshTokenMaxAge,
      ...(this.config.cookieDomain && { domain: this.config.cookieDomain }),
    });

    return res;
  }

  /**
   * Clear session cookies
   */
  clearSessionCookies(res: NextResponse): NextResponse {
    // Clear access token cookie
    res.cookies.set({
      name: this.config.accessTokenCookieName,
      value: '',
      expires: new Date(0),
      path: '/',
    });

    // Clear refresh token cookie
    res.cookies.set({
      name: this.config.refreshTokenCookieName,
      value: '',
      expires: new Date(0),
      path: '/',
    });

    return res;
  }

  /**
   * Normalize user object from Supabase
   */
  private normalizeUser(user: User): SessionUser {
    return {
      id: user.id,
      email: user.email || '',
      role: user.user_metadata?.role || 'user',
      email_verified: user.email_confirmed_at !== null,
      ...(user as Omit<SessionUser, 'id' | 'email'>),
    };
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
}

// Export a singleton instance
export const sessionManager = new SessionManager();

// Export types
export type { SessionUser, SessionValidationResult, RefreshResult } from './types';

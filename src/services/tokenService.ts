import type { Request } from 'express';
import { createHash, randomBytes } from 'crypto';
import { supabaseClient } from '@/lib/supabaseClient';
import type { TokenPayload } from '../types/supabase';
import { auditEvents } from './auditService';

// Constants
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const SESSION_EXPIRY_DAYS = 30;

// Database session type from refresh_tokens table
interface DBSession {
  id: string;
  session_id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  ip_address: string;
  user_agent: string | null;
  revoked: boolean;
  data?: {
    device_info?: string;
    location?: string;
  };
}

// User session information for the client
interface UserSession {
  id: string;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  ipAddress: string;
  userAgent: string | null;
  isRevoked: boolean;
  deviceInfo?: string;
  location?: string;
  isCurrent: boolean;
  isExpired: boolean;
  lastActive: string;
}

// Current session information
export interface CurrentSession {
  session: (TokenPayload & { 
    id: string;
    exp?: number;
    roles?: Record<string, boolean>;
    isAdmin?: boolean;
  }) | null;
  userId?: string;
  sessionId?: string;
}

// Interface for refresh token data
interface RefreshTokenData {
  token: string;
  expiresAt: Date;
  sessionId: string;
  userId: string;
  ipAddress: string;
  userAgent: string | undefined;
  deviceInfo?: string;
  location?: string;
}

// Interface for token validation result
interface TokenValidationResult {
  isValid: boolean;
  sessionId?: string;
  userId?: string;
  error?: string;
}

export class TokenService {
  /**
   * Store a refresh token in the database with enhanced metadata
   */
  static async storeRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
    req?: Request,
    sessionId?: string
  ): Promise<{ id: string }> {
    const hashedToken = this.hashToken(token);
    const ipAddress = req?.ip || req?.socket?.remoteAddress || '';
    const userAgent = req?.headers['user-agent'] || '';
    const sessionIdentifier = sessionId || this.generateSessionId();

    const { data, error } = await supabaseClient.rpc('create_refresh_token', {
      p_user_id: userId,
      p_token: hashedToken,
      p_expires_at: expiresAt.toISOString(),
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_session_id: sessionIdentifier
    });

    if (error) {
      console.error('Error storing refresh token:', error);
      throw new Error('Failed to store refresh token');
    }

    return { id: sessionIdentifier };
  }

  // Generate a secure random session ID
  private static generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  // Check if a refresh token is valid and return session info
  static async validateRefreshToken(
    token: string,
    req?: Request
  ): Promise<{ isValid: boolean; userId?: string; sessionId?: string }> {
    const hashedToken = this.hashToken(token);
    
    const { data, error } = await supabaseClient.rpc('validate_refresh_token', {
      p_token: hashedToken,
      p_ip_address: req?.ip || ''
    });
    
    if (error || !data) {
      console.error('Token validation error:', error);
      return { isValid: false };
    }
    
    return {
      isValid: data.is_valid,
      userId: data.user_id,
      sessionId: data.session_id
    };
  }

  // Revoke a specific refresh token by token value or session ID
  static async revokeRefreshToken(tokenOrSessionId: string, bySessionId = false): Promise<boolean> {
    try {
      if (bySessionId) {
        const { error } = await supabaseClient.rpc('revoke_refresh_token_by_session', {
          p_session_id: tokenOrSessionId
        });
        return !error;
      }
      
      const hashedToken = this.hashToken(tokenOrSessionId);
      const { error } = await supabaseClient.rpc('revoke_refresh_token', {
        p_token: hashedToken
      });
      
      return !error;
    } catch (error) {
      console.error('Error revoking token:', error);
      return false;
    }
  }

  // Revoke all refresh tokens for a user
  static async revokeAllUserTokens(userId: string): Promise<void> {
    await supabaseClient.rpc('revoke_all_user_refresh_tokens', { 
      p_user_id: userId 
    });
  }

  // Clean up expired tokens
  static async cleanupExpiredTokens(): Promise<void> {
    await supabaseClient.rpc('cleanup_expired_tokens');
  }

  // Hash token for secure storage
  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }


  /**
   * Get active sessions for a user with enhanced session info
   */
  static async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      const { data, error } = await supabaseClient
        .from('refresh_tokens')
        .select(`
          id,
          session_id,
          created_at,
          expires_at,
          last_used_at,
          ip_address,
          user_agent,
          revoked,
          data->device_info,
          data->location
        `)
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false });

      if (error) {
        console.error('Error fetching user sessions:', error);
        throw new Error('Failed to fetch user sessions');
      }

      return (data || []).map((session: DBSession) => ({
        id: session.id,
        sessionId: session.session_id,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        lastUsedAt: session.last_used_at,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        isRevoked: session.revoked,
        deviceInfo: session.data?.device_info,
        location: session.data?.location,
        isCurrent: false, // Will be set by the caller if needed
        isExpired: new Date(session.expires_at) < new Date(),
        lastActive: session.last_used_at || session.created_at
      }));
    } catch (error) {
      console.error('Error in getUserSessions:', error);
      throw new Error('Failed to retrieve user sessions');
    }
  }

  /**
   * Get current session from request
   */
  static async getCurrentSession(req: Request & { user?: any }): Promise<CurrentSession> {
    try {
      // First check for access token
      const accessToken = req.cookies?.['sb-access-token'] || 
                         req.headers.authorization?.split(' ')[1];
      
      if (!accessToken) {
        return { session: null };
      }

      // Verify the access token with Supabase
      const { data: { user }, error } = await supabaseClient.auth.getUser(accessToken);
      
      if (error || !user) {
        return { session: null };
      }
      
      // Define the user roles type
      interface UserRoles {
        id: string;
        user_id: string;
        is_admin: boolean;
        is_donor: boolean;
        is_volunteer: boolean;
        is_member: boolean;
        is_viewer: boolean;
        created_at: string;
        updated_at: string;
      }

      // Get user roles from the database
      const { data: userData } = await supabaseClient
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .single<UserRoles>();

      // If we have a refresh token in the request, validate it too
      let sessionId: string | undefined;
      const refreshToken = req.cookies?.['sb-refresh-token'];
      
      if (refreshToken) {
        try {
          const { isValid, sessionId: sid } = await this.validateRefreshToken(refreshToken, req);
          if (isValid && sid) {
            sessionId = sid;
            
            // Update last used timestamp
            const { error } = await supabaseClient.rpc('update_token_last_used', {
              p_session_id: sid,
              p_ip_address: req.ip || ''
            });
            
            if (error) {
              console.error('Error updating token last used:', error);
              throw error;
            }
          }
        } catch (error) {
          console.error('Error validating refresh token:', error);
          // Continue with the access token validation even if refresh token validation fails
        }
      }

      return {
        session: {
          ...user,
          id: user.id,
          userId: user.id, // Add userId for backward compatibility
          exp: user.user_metadata?.exp || Math.floor(Date.now() / 1000) + 3600, // Default to 1 hour if not set
          roles: {
            isAdmin: userData?.is_admin || false,
            isDonor: userData?.is_donor || false,
            isVolunteer: userData?.is_volunteer || false,
            isMember: userData?.is_member || false,
            isViewer: userData?.is_viewer !== false // Default to true if not set
          },
          isAdmin: userData?.is_admin || false,
          iat: Math.floor(Date.now() / 1000) // Add issued at timestamp
        },
        userId: user.id,
        sessionId
      } as CurrentSession;
    } catch (error) {
      console.error('Error getting current session:', error);
      return { session: null };
    }
  }
  
  // Rotate refresh token (invalidate old, issue new)
  static async rotateRefreshToken(
    oldToken: string, 
    userId: string, 
    req?: Request
  ): Promise<{ newToken: string; expiresAt: Date } | null> {
    // Generate new token
    const newToken = randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    
    // Get session ID from old token
    const { sessionId } = await this.validateRefreshToken(oldToken, req);
    
    if (!sessionId) {
      throw new Error('Invalid or expired refresh token');
    }
    
    // Store new token with same session ID
    await this.storeRefreshToken(
      userId, 
      newToken, 
      expiresAt, 
      req,
      sessionId
    );
    
    // Invalidate old token
    await this.revokeRefreshToken(oldToken);
    
    return { newToken, expiresAt };
  }
}

// Export a singleton instance
export const tokenService = new TokenService();

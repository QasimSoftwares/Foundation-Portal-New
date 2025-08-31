import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import { supabaseClient } from './supabaseClient';
import { auditEvents } from '../services/auditService';

const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TokenPayload {
  userId: string;
  email: string;
  roles: Record<string, boolean>;
  isAdmin: boolean;
  iat: number;
  exp: number;
}

export class SessionManager {
  // Generate a new access token (JWT)
  static async generateAccessToken(user: {
    id: string;
    email: string;
    roles: Record<string, boolean>;
    isAdmin: boolean;
  }): Promise<string> {
    // In a real implementation, sign with a private key
    const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64');
    const payload = Buffer.from(
      JSON.stringify({
        userId: user.id,
        email: user.email,
        roles: user.roles,
        isAdmin: user.isAdmin,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor((Date.now() + ACCESS_TOKEN_EXPIRY) / 1000),
      })
    ).toString('base64');
    
    return `${header}.${payload}.${this.signToken(header, payload)}`;
  }

  // Generate a secure refresh token
  static async generateRefreshToken(userId: string, ipAddress: string, userAgent: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(token);
    
    await supabaseClient.rpc('create_refresh_token', {
      p_user_id: userId,
      p_token: hashedToken,
      p_expires_in_seconds: Math.floor(REFRESH_TOKEN_EXPIRY / 1000),
      p_ip_address: ipAddress,
      p_user_agent: userAgent
    });
    
    return token;
  }

  // Validate a refresh token
  static async validateRefreshToken(token: string, userId?: string): Promise<boolean> {
    const hashedToken = this.hashToken(token);
    const { data, error } = await supabaseClient.rpc('validate_refresh_token', {
      p_token: hashedToken,
      p_user_id: userId
    });
    
    return !error && data?.is_valid === true;
  }

  // Revoke all refresh tokens for a user
  static async revokeUserRefreshTokens(userId: string): Promise<void> {
    await supabaseClient.rpc('revoke_all_user_refresh_tokens', { p_user_id: userId });
  }

  // Set auth cookies
  static setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie('sb-access-token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_EXPIRY
    });

    res.cookie('sb-refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: REFRESH_TOKEN_EXPIRY
    });
  }

  // Clear auth cookies
  static clearAuthCookies(res: Response): void {
    res.clearCookie('sb-access-token');
    res.clearCookie('sb-refresh-token', { path: '/auth/refresh' });
  }

  // Parse JWT (without verification for demo - use a proper JWT library in production)
  static parseJwt(token: string): TokenPayload | null {
    try {
      const base64Payload = token.split('.')[1];
      const payload = Buffer.from(base64Payload, 'base64').toString();
      return JSON.parse(payload);
    } catch (error) {
      return null;
    }
  }

  // Hash token for storage
  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Sign token (in a real implementation, use a proper signing key)
  private static signToken(header: string, payload: string): string {
    return createHash('sha256')
      .update(`${header}.${payload}.${process.env.JWT_SECRET || 'your-secret-key'}`)
      .digest('hex');
  }
}

// Middleware to verify access token
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies['sb-access-token'];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = SessionManager.parseJwt(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // In production, verify the token signature here
    // This is a simplified example
    
    // Add user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || {},
      isAdmin: decoded.isAdmin || false
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user has required role
export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = req.user.roles || {};
    if (!userRoles[requiredRole]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to check if user is admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

import { type NextRequest, NextResponse } from 'next/server';
import { sessionManager } from './sessionManager';
import type { SessionUser } from './types';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase/client';

// Extend the Request type to include the user
declare module 'next/server' {
  interface NextRequest {
    user?: SessionUser;
  }
}

type WithSessionOptions = {
  requireAuth?: boolean;
  requiredRoles?: string[];
  requireEmailVerified?: boolean;
  onError?: (error: { code: string; message: string }) => void;
};

/**
 * Middleware to handle session validation and user attachment
 */
export async function withSession(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: WithSessionOptions = {}
): Promise<NextResponse> {
  const { requireAuth = true, requiredRoles = [], requireEmailVerified = false, onError } = options;
  
  try {
    // Get the user from the session
    const user = await sessionManager.getUser();
    
    // Attach user to the request
    req.user = user || undefined;

    // Check authentication if required
    if (requireAuth && !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check email verification if required
    if (requireAuth && requireEmailVerified && user && !user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Email verification required' },
        { status: 403 }
      );
    }

    // Check roles if required
    if (requireAuth && requiredRoles.length > 0 && user) {
      const hasRequiredRole = requiredRoles.some(role => user.role === role);
      if (!hasRequiredRole) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Call the handler if all checks pass
    return await handler(req);
  } catch (error) {
    console.error('Session middleware error:', error);
    if (onError) {
      onError({ code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while processing your request' });
    }
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

/**
 * Helper to create route handlers with session management
 */
export function createRouteHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: WithSessionOptions = {}
) {
  return async (req: NextRequest) => {
    return withSession(req, handler, options);
  };
}

/**
 * Middleware to refresh the session if needed
 */
export async function withSessionRefresh(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // Create a response that we can modify
  const response = NextResponse.next();
  
  try {
    // Get the refresh token from the request
    const refreshToken = req.cookies.get(sessionManager.getRefreshTokenCookieName())?.value;
    
    if (refreshToken) {
      // Try to refresh the session using Supabase client directly
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });
      
      if (data?.session && !error) {
        const session = data.session;
        // Set cookies using the session manager's config
        const cookieOptions = {
          httpOnly: true,
          secure: sessionManager.getSecureCookies(),
          sameSite: sessionManager.getSameSite(),
          path: '/',
        };

        // Set access token cookie
        response.cookies.set({
          name: sessionManager.getAccessTokenCookieName(),
          value: session.access_token,
          ...cookieOptions,
          maxAge: sessionManager.getAccessTokenMaxAge(),
        });

        // Set refresh token cookie if available
        if (session.refresh_token) {
          response.cookies.set({
            name: sessionManager.getRefreshTokenCookieName(),
            value: session.refresh_token,
            ...cookieOptions,
            maxAge: sessionManager.getRefreshTokenMaxAge(),
          });
        }
        
        // Update the request with the new access token
        req.cookies.set({
          name: sessionManager.getAccessTokenCookieName(),
          value: session.access_token,
        });
      }
    }
    
    // Call the handler with the updated request
    return await handler(req);
  } catch (error) {
    console.error('Session refresh error:', error);
    return response;
  }
}

// Export types
export type { WithSessionOptions, SessionUser } from './types';

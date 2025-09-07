import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { sessionManager } from '@/security/session/sessionManager';
import { securityLogger } from '@/lib/security/securityLogger';
import { getClientIp } from '@/lib/utils/ip-utils';
import { logger } from '@/lib/logger';
import { Buffer } from 'buffer';

type User = {
  id: string;
  email?: string;
};

export async function POST(request: Request) {
  let user: User | null = null;
  const forwardedFor = request.headers.get('x-forwarded-for');
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = getClientIp(forwardedFor);
  
  // Create a response that will be used to clear cookies
  const response = new NextResponse(JSON.stringify({ message: 'Signed out successfully' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const cookie = cookieStore.get(name)?.value;
            // If the cookie is in base64 format, decode it
            if (cookie && cookie.startsWith('base64-')) {
              try {
                return Buffer.from(cookie.slice(7), 'base64').toString('utf-8');
              } catch (e) {
                // If decoding fails, return the original cookie
                return cookie;
              }
            }
            return cookie;
          },
          set(name: string, value: string, options: any) {
            // Don't modify the cookie if it's already in the correct format
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
              maxAge: 0,
            });
          },
        },
      }
    );

    // Get the current user and session before signing out
    const [
      { data: userData },
      { data: sessionData }
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession()
    ]);
    
    user = userData.user;
    const session = sessionData.session;
    
    // Sign out from Supabase
    const { error: signOutError } = await supabase.auth.signOut();
    
    if (signOutError) {
      throw new Error(`Supabase signout failed: ${signOutError.message}`);
    }

      // Clear session cookies
      if (user?.id) {
        // Revoke the server-side session
        if (session?.access_token) {
          try {
            // Extract the session ID from the JWT
            const [_header, payload] = session.access_token.split('.');
            const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
            const sessionId = decodedPayload.session_id;
            
            if (!sessionId) {
              throw new Error('Session ID not found in JWT');
            }
            
            await sessionManager.revokeSession({
              sessionId,
              reason: 'user_logout'
            });
            logger.info('Server-side session revoked', { userId: user.id });
          } catch (revokeError) {
            // Log the error but don't fail the sign-out process
            if (revokeError) {
              const errorMessage = revokeError instanceof Error 
                ? revokeError.message 
                : String(revokeError);
              
              // Log the error with proper error object
              if (errorMessage) {
                const errorObj = new Error(`Error revoking server-side session: ${errorMessage}`);
                if (revokeError instanceof Error) {
                  errorObj.stack = revokeError.stack;
                }
                // Log error details
                const errorDetails = { 
                  message: errorObj.message, 
                  stack: errorObj.stack,
                  context: { userId: user?.id }
                };
                logger.error(JSON.stringify(errorDetails));
              }
            }
          }
        }
        
        // Delete access token cookie
        response.cookies.set({
          name: sessionManager.getAccessTokenCookieName(),
          value: '',
          path: '/',
          maxAge: 0,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
        });
        
        // Delete refresh token cookie
        response.cookies.set({
          name: sessionManager.getRefreshTokenCookieName(),
          value: '',
          path: '/',
          maxAge: 0,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
        });
        
        // Log the successful logout
        await securityLogger.logLogout(user.id, ip, userAgent);
      }

    return response;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error in signout route:', error);
    
    // Log the security alert
    await securityLogger.logSecurityAlert(
      'signout_failed',
      `Signout failed: ${errorMessage}`,
      {
        error: errorMessage,
        stack: errorStack,
        ip,
        userAgent,
        userId: user?.id || 'unknown'
      }
    );
    
    // Ensure cookies are cleared even if there was an error
    if (user?.id) {
      response.cookies.set({
        name: sessionManager.getAccessTokenCookieName(),
        value: '',
        path: '/',
        maxAge: 0,
      });
      response.cookies.set({
        name: sessionManager.getRefreshTokenCookieName(),
        value: '',
        path: '/',
        maxAge: 0,
      });
    }
    
    return NextResponse.json(
      { error: 'An error occurred during sign out' },
      { 
        status: 500,
        headers: response.headers
      }
    );
  }
}

// Prevent caching of the signout endpoint
export const dynamic = 'force-dynamic';

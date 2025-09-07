import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sessionManager } from '@/security/session/sessionManager';
import { getClientIp } from '@/lib/utils/ip-utils';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const forwardedFor = request.headers.get('x-forwarded-for');
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const uaHash = Buffer.from(userAgent).toString('base64').slice(0, 16);
  const ip = getClientIp(forwardedFor);
  const cookieStore = await cookies();

  try {
    // Create a response that will be used to set cookies
    const response = new NextResponse();
    
    // Create a Supabase client with cookie handling
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

    // Sign in with email and password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      const message = error?.message || 'Invalid login credentials';
      logger.warn('Sign in failed', { 
        email, 
        ip,
        uaHash,
        message,
      });
      return NextResponse.json(
        { error: { code: 'SIGNIN_FAILED', message } },
        { status: 401, headers: response.headers }
      );
    }

    // Start a new session in our database
    await sessionManager.startSession({
      userId: data.user.id,
      session: data.session,
      ip,
      deviceId: null // Optional: Add device fingerprinting if needed
    });

    // Set cookies using the session manager's config
    const cookieOptions = {
      httpOnly: true,
      secure: sessionManager.getSecureCookies(),
      sameSite: sessionManager.getSameSite(),
      path: '/',
    };

    // Set access token cookie as JSON string
    const accessTokenValue = JSON.stringify({
      access_token: data.session.access_token,
      expires_at: Math.floor(Date.now() / 1000) + sessionManager.getAccessTokenMaxAge(),
      expires_in: sessionManager.getAccessTokenMaxAge(),
      token_type: 'bearer',
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      },
    });

    response.cookies.set({
      name: sessionManager.getAccessTokenCookieName(),
      value: accessTokenValue,
      ...cookieOptions,
      maxAge: sessionManager.getAccessTokenMaxAge(),
    });

    // Set refresh token cookie as JSON string if available
    if (data.session.refresh_token) {
      const refreshTokenValue = JSON.stringify({
        refresh_token: data.session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + sessionManager.getRefreshTokenMaxAge(),
        expires_in: sessionManager.getRefreshTokenMaxAge(),
      });

      response.cookies.set({
        name: sessionManager.getRefreshTokenCookieName(),
        value: refreshTokenValue,
        ...cookieOptions,
        maxAge: sessionManager.getRefreshTokenMaxAge(),
      });
    }

    logger.info('User signed in', { 
      userId: data.user.id, 
      email, 
      ip, 
      uaHash 
    });

    // Return user data (excluding sensitive info)
    const { user } = data;
    const userData = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name,
      email_verified: user.email_confirmed_at !== null,
    };

    return NextResponse.json({ user: userData }, {
      status: 200,
      headers: response.headers,
    });

  } catch (error: any) {
    logger.error('Sign in error', error, { 
      stack: error.stack,
      ip,
      uaHash
    });
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An error occurred during sign in' } },
      { status: 500 }
    );
  }
}

// Prevent caching of this endpoint
export const dynamic = 'force-dynamic';
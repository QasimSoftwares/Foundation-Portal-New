import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { 
  fetchUserRoles, 
  type UserRole, 
  getHighestRole, 
  getDashboardPath 
} from '@/lib/security/roles';
import { getClientIp } from '@/lib/utils/ip-utils';
import { logger } from '@/lib/utils/logger';
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
      const isInvalidCredentials = error?.status === 400;
      const message = isInvalidCredentials ? 'Incorrect email or password' : (error?.message || 'Invalid login credentials');
      const errorCode = isInvalidCredentials ? 'INVALID_CREDENTIALS' : 'AUTH_ERROR';
      
      logger.warn(`[Auth] Sign in failed email=${email} ip=${ip} uaHash=${uaHash} code=${errorCode} msg=${message}`);
      
      return NextResponse.json(
        { error: { code: errorCode, message } },
        { status: 401, headers: response.headers }
      );
    }

    // Ensure session is properly established by confirming it exists
    const { data: { session: confirmedSession } } = await supabase.auth.getSession();
    if (!confirmedSession) {
      logger.error(`[Auth] Session confirmation failed after successful sign-in for user ${data.user.id}`);
      return NextResponse.json(
        { error: { code: 'SESSION_ERROR', message: 'Failed to establish session' } },
        { status: 500, headers: response.headers }
      );
    }

    // Note: The original code used a sessionManager which is deprecated.
    // The Supabase client's `set` handler for cookies already manages setting the auth tokens.
    // The signInWithPassword call above triggers the `set` handler in the createServerClient config.

    logger.info(`[Auth] User signed in userId=${data.user.id} email=${email} ip=${ip} uaHash=${uaHash}`);

    const { user, session } = data;
    let roles: UserRole[] = [];

    // Fetch user roles once
    try {
      roles = await fetchUserRoles(user.id, { accessToken: session.access_token });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn(`[Auth] Could not fetch user roles for user ${user.id}: ${msg}`);
      // Default to viewer role if fetching fails to prevent login failure
      roles = ['viewer'];
    }

    // Set the active-role cookie
    const highestRole = getHighestRole(roles);
    
    // Set secure cookie options based on environment
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    };

    // Set the active role cookie
    response.cookies.set({
      name: 'active-role',
      value: highestRole,
      ...cookieOptions
    });

    // Clear any redirect count cookie that might be set
    response.cookies.set({
      name: '_redirect_count',
      value: '0',
      ...cookieOptions,
      maxAge: 0 // Expire immediately
    });

    // Get the dashboard path based on the user's highest role
    const dashboard = getDashboardPath(highestRole);

    const userData = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name,
      email_verified: user.email_confirmed_at !== null,
    };

    // Include tokens so client can establish Supabase-js session (localStorage)
    const sessionTokens = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    };

    // Return the response with all cookies set
    const jsonResponse = NextResponse.json(
      { 
        user: userData, 
        session: sessionTokens, 
        dashboard 
      },
      { 
        status: 200,
        headers: response.headers,
      }
    );

    // Copy all cookies from the response to the JSON response
    response.cookies.getAll().forEach(cookie => {
      jsonResponse.cookies.set(cookie);
    });

    return jsonResponse;

  } catch (error: any) {
    logger.error(`[Auth] Sign in error: ${error?.message || String(error)} ip=${ip} uaHash=${uaHash}`);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An error occurred during sign in' } },
      { status: 500 }
    );
  }
}

// Prevent caching of this endpoint
export const dynamic = 'force-dynamic';
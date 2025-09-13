import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { securityLogger } from '@/lib/security/securityLogger';
import { getClientIp } from '@/lib/utils/ip-utils';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/utils/logger';

export async function POST(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = getClientIp(forwardedFor);
  const cookieStore = await cookies();
  
  try {
    // Create a response that will be used to set new cookies
    const response = new NextResponse(JSON.stringify({ message: 'Token refreshed' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Create a Supabase client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
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

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error(userError?.message || 'Not authenticated');
    }

    // Get the refresh token from cookies
    const refreshToken = cookieStore.get('sb-refresh-token')?.value;
    
    if (!refreshToken) {
      throw new Error('No refresh token found');
    }

    // Refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
    const newSession = refreshData?.session;

    if (refreshError || !newSession) {
      throw new Error(refreshError?.message || 'Failed to refresh session');
    }

    // Note: The original code used a sessionManager which is deprecated.
    // We are now setting cookies directly. The Supabase client's `set` and `remove` handlers for cookies already manage this.
    // The refreshSession call above triggers the `set` handler in the createServerClient config, which updates the cookies on the `response` object.
    // No manual cookie setting is needed here as it's handled by the Supabase SSR client.

    // Log the successful token refresh
    if (user?.id) {
      await securityLogger.logTokenRefresh(user.id, {
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
      });
    }

    return response;
    
  } catch (error: any) {
    logger.error(`Error refreshing token: ${error?.message || String(error)}`);
    
    // Log the error
    await securityLogger.logSecurityAlert(
      null,
      'Token refresh failed',
      {
        error: error.message,
        stack: error.stack,
        ip,
        userAgent
      }
    );
    
    // Clear invalid session
    const errorResponse = NextResponse.json(
      { error: 'Failed to refresh session. Please sign in again.' },
      { status: 401 }
    );
    
    // Clear session cookies on error
    errorResponse.cookies.delete('sb-access-token');
    errorResponse.cookies.delete('sb-refresh-token');
    
    return errorResponse;
  }
}

// Prevent caching of the refresh endpoint
export const dynamic = 'force-dynamic';

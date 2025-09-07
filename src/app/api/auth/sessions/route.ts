import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { sessionManager } from '@/security/session/sessionManager';
import { securityLogger } from '@/lib/security/securityLogger';
import { getClientIp } from '@/lib/utils/ip-utils';

// GET /api/auth/sessions - List all active sessions for the current user
export async function GET() {
  const cookieStore = await cookies();
  
  try {
    // Create a Supabase client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {
            // no-op for GET
          },
          remove() {
            // no-op for GET
          },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error(userError?.message || 'Not authenticated');
    }

    // Get all active sessions for the user
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        session_id,
        created_at,
        last_seen_at,
        ip,
        ua_hash,
        device_id,
        revoked_at,
        revoked_reason
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    // Get current session ID from cookies
    const currentSessionId = cookieStore.get('sb-session-id')?.value;

    // Format the response
    const formattedSessions = sessions.map(session => ({
      id: session.session_id,
      isCurrent: session.session_id === currentSessionId,
      createdAt: session.created_at,
      lastActive: session.last_seen_at || session.created_at,
      ipAddress: session.ip,
      userAgent: session.ua_hash,
      deviceId: session.device_id,
      isRevoked: !!session.revoked_at,
      revokedAt: session.revoked_at,
      revokedReason: session.revoked_reason,
    }));

    return NextResponse.json({ sessions: formattedSessions });
    
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    
    // Log the error
    await securityLogger.logSecurityAlert(
      null,
      'Failed to fetch sessions',
      {
        error: error.message,
        stack: error.stack,
      }
    );
    
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/sessions - Revoke a session
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = getClientIp(forwardedFor);
  const cookieStore = await cookies();
  
  try {
    // Create a Supabase client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {
            // no-op for DELETE
          },
          remove() {
            // no-op for DELETE
          },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error(userError?.message || 'Not authenticated');
    }

    // Check if the session belongs to the user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'Session not found');
    }

    if (session.user_id !== user.id) {
      // Log potential security issue
      await securityLogger.logSecurityAlert(
        user.id,
        'Attempted to revoke another user\'s session',
        {
          attemptedSessionId: sessionId,
          ip,
          userAgent,
        }
      );
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Revoke the session
    const { error: revokeError } = await supabase
      .from('sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: 'revoked_by_user',
      })
      .eq('session_id', sessionId);

    if (revokeError) {
      throw new Error(`Failed to revoke session: ${revokeError.message}`);
    }

    // Also revoke any refresh tokens for this session
    await supabase
      .from('refresh_tokens')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: 'session_revoked',
      })
      .eq('session_id', sessionId);

    // Log the session revocation
    await securityLogger.logSecurityAlert(
      user.id,
      'Session revoked',
      {
        sessionId,
        ip,
        userAgent,
      }
    );

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Error revoking session:', error);
    
    // Log the error
    await securityLogger.logSecurityAlert(
      null,
      'Failed to revoke session',
      {
        error: error.message,
        stack: error.stack,
        sessionId,
        ip,
        userAgent,
      }
    );
    
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}

// Prevent caching of these endpoints
export const dynamic = 'force-dynamic';

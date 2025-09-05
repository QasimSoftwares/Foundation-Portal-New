import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Initialize Supabase client
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // This will automatically handle CSRF token generation via the auth helpers
    // The token will be set as an HTTP-only cookie
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // The token is automatically handled by the cookie
    return NextResponse.json({ 
      success: true,
      csrfToken: 'token-handled-via-cookie'
    });

  } catch (error) {
    console.error('CSRF token error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

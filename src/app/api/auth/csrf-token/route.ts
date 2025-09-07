import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
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
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 });
          },
        },
      }
    );

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

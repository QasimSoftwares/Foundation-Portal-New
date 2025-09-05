import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const formData = await request.json();
    const { email, password } = formData;

    // Create a response that will set the auth cookies
    const response = NextResponse.redirect(requestUrl.origin, {
      status: 302,
    });

    // Get cookies from the request
    const cookieStore = await cookies();

    // Create the Supabase client with cookie handling
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              response.cookies.set({
                name,
                value,
                ...options,
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
              });
              return { name, value, ...options };
            } catch (error) {
              console.error('Error setting cookie:', error);
              return null;
            }
          },
          remove(name: string, options: any) {
            try {
              response.cookies.set({
                name,
                value: '',
                ...options,
                path: '/',
                maxAge: 0,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
              });
              return { name, value: '', ...options, maxAge: 0 };
            } catch (error) {
              console.error('Error removing cookie:', error);
              return null;
            }
          },
        },
      }
    );

    // Sign in the user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Invalid login credentials' },
        { status: 401 }
      );
    }

    // Set Supabase session cookies
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token || '',
    });

    // Fetch user roles
    const { data: rolesData } = await supabase
      .rpc('get_user_roles', { p_user_id: data.user.id });

    // Return user info
    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        roles: rolesData || {},
      },
    });

  } catch (err) {
    console.error('Sign in error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

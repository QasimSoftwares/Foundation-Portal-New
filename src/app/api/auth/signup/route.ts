import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password, fullName, acceptTerms } = await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({
        error: 'MISSING_FIELDS',
        message: 'All fields are required',
      }, { status: 400 });
    }

    if (!acceptTerms) {
      return NextResponse.json({
        error: 'TERMS_NOT_ACCEPTED',
        message: 'You must accept the terms and conditions',
      }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {
            // We set our own auth cookies via sessionManager
          },
          remove() {
            // We clear our own auth cookies via sessionManager
          },
        },
      },
    );

    // Check if user already exists by attempting to get user by email
    const { data: authUsers, error: userCheckError } = await supabase.auth.admin.listUsers();
    
    // Check if any user exists with this email
    const userExists = authUsers?.users?.some(u => u.email === email);
    
    if (userExists) {
      return NextResponse.json({
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists',
      }, { status: 409 });
    }

    // Create user in Supabase Auth
    // The handle_new_user() trigger will automatically create the profile and assign default role
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          full_name: fullName,
          // Add any additional metadata here
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email`,
      },
    });

    if (error) {
      return NextResponse.json({
        error: 'SIGNUP_FAILED',
        message: error.message || 'Failed to create account. Please try again.',
      }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({
        error: 'USER_CREATION_FAILED',
        message: 'Failed to create user account',
      }, { status: 500 });
    }

    const responseBody = {
      message: 'Account created successfully. Please check your email to verify your account.',
      email: data.user.email,
      requiresConfirmation: !data.session,
    };

    // Build response and set cookies if session exists
    const res = NextResponse.json(responseBody, { status: 201 });
    
    if (data.session) {
      // Note: The Supabase client's `set` handler for cookies will manage setting the auth tokens if a session is created.
      // The signUp call above triggers the `set` handler in the createServerClient config.
    }

    return res;
  } catch (e: any) {
    return NextResponse.json({
      error: 'INTERNAL_SERVER_ERROR',
      message: e?.message || 'An unexpected error occurred while creating your account.',
    }, { status: 500 });
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { createApiResponse } from '@/lib/api-utils';
import { SignUpRequest } from '@/types/api';
import { sessionManager } from '@/security/session';
import { NextResponse } from 'next/server';

// CSRF protection is handled by the middleware
export default async function signupHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    console.error('Signup error:', 'Method not allowed');
    return createApiResponse(res, 405, undefined, {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed',
    });
  }

  try {
    const { email, password, fullName, acceptTerms } = req.body as SignUpRequest;

    // Basic validation
    if (!email || !password || !fullName) {
      return createApiResponse(res, 400, undefined, {
        code: 'MISSING_FIELDS',
        message: 'All fields are required',
      });
    }

    if (!acceptTerms) {
      return createApiResponse(res, 400, undefined, {
        code: 'TERMS_NOT_ACCEPTED',
        message: 'You must accept the terms and conditions',
      });
    }

    const supabase = sessionManager.getSupabaseClient();
    
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return createApiResponse(res, 409, undefined, {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email`,
      },
    });

    if (error) {
      console.error('Signup error:', error);
      return createApiResponse(res, 400, undefined, {
        code: 'SIGNUP_FAILED',
        message: error.message || 'Failed to create account. Please try again.',
      });
    }

    if (!data.user) {
      return createApiResponse(res, 500, undefined, {
        code: 'USER_CREATION_FAILED',
        message: 'Failed to create user account',
      });
    }

    // Create user profile in database
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          email: email,
          full_name: fullName,
          verification_status: 'pending',
          role: 'user',
        },
      ]);

    if (profileError) {
      console.error('Failed to create user profile:', profileError);
      // Attempt to delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(data.user.id);
      return createApiResponse(res, 500, undefined, {
        code: 'PROFILE_CREATION_FAILED',
        message: 'Failed to create user profile',
      });
    }

    // Send verification email if it wasn't sent automatically
    if (!data.session) {
      const { error: emailError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email`,
        },
      });

      if (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
    }

    // Create a response
    const response = {
      message: 'Account created successfully. Please check your email to verify your account.',
      email: data.user.email,
      requiresConfirmation: true,
    };

    // If we have a session (email confirmation not required), set session cookies
    if (data.session) {
      const nextRes = new NextResponse(JSON.stringify(response), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Set secure session cookies
      sessionManager.setSessionCookies(nextRes, data.session);

      // Copy cookies to the Express response
      nextRes.cookies.getAll().forEach(cookie => {
        res.setHeader('Set-Cookie', cookie.toString());
      });
    }

    return createApiResponse(res, 201, response);
  } catch (error) {
    console.error('Unexpected signup error:', error);
    return createApiResponse(res, 500, undefined, {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred while creating your account.',
    });
  }
}

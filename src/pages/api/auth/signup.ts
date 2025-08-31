import { NextApiRequest, NextApiResponse } from 'next';
import { createApiResponse } from '@/lib/api-utils';
import { SignUpRequest } from '@/types/api';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

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

    const supabase = createServerSupabaseClient<Database>({ req, res });
    
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
      return createApiResponse(res, 400, undefined, {
        code: 'SIGNUP_FAILED',
        message: 'Failed to create account. Please try again.',
        details: error.message,
      });
    }

    // Create user profile in database using RPC
    const { error: profileError } = await supabase.rpc('create_user_profile', {
      p_user_id: data.user?.id,
      p_email: email,
      p_full_name: fullName,
    });

    if (profileError) {
      console.error('Failed to create user profile:', profileError);
      // Don't fail the request since auth was successful
    }

    // Don't send sensitive data back
    return createApiResponse(res, 201, {
      message: 'Account created successfully. Please check your email to verify your account.',
      email: data.user?.email,
      requiresConfirmation: true,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return createApiResponse(res, 500, undefined, {
      code: 'SIGNUP_ERROR',
      message: 'An error occurred while creating your account. Please try again.'
    });
  }
}

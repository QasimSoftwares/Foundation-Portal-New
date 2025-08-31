import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { createApiResponse } from '@/lib/api-utils';

type SignInRequest = {
  email: string;
  password: string;
};

type SignInResponse = {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
  error?: {
    message: string;
    code?: string;
  };
};

async function signInHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return createApiResponse(res, 405, undefined, {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are allowed',
    });
  }

  try {
    const { email, password } = req.body as SignInRequest;

    // Basic validation
    if (!email || !password) {
      return createApiResponse(res, 400, undefined, {
        code: 'MISSING_CREDENTIALS',
        message: 'Email and password are required',
      });
    }

    // Initialize Supabase client
    const supabase = createServerSupabaseClient<Database>({ req, res });

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error.message);
      
      // Handle specific error cases
      let errorMessage = 'Invalid login credentials';
      let errorCode = 'INVALID_CREDENTIALS';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email before signing in';
        errorCode = 'EMAIL_NOT_VERIFIED';
      } else if (error.message.includes('too many requests')) {
        errorMessage = 'Too many sign in attempts. Please try again later.';
        errorCode = 'RATE_LIMIT_EXCEEDED';
      }
      
      return createApiResponse(res, 400, undefined, {
        code: errorCode,
        message: errorMessage,
      });
    }

    if (!data.session) {
      res.status(500).json({
        error: {
          message: 'No session returned after sign in',
          code: 'NO_SESSION',
        },
      });
      return;
    }

    // Return the user data without sensitive information
    res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
        role: data.user.user_metadata?.role,
      },
    });
  } catch (error) {
    console.error('Unexpected error during sign in:', error);
    res.status(500).json({
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR',
      },
    });
  }
};

// CSRF protection is handled by the middleware
export default signInHandler;

import { NextApiRequest, NextApiResponse } from 'next';
import { createApiResponse } from '@/lib/api-utils';
import { ForgotPasswordRequest } from '@/types/api';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

// CSRF protection is handled by the middleware
export default async function forgotPasswordHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    console.error('Forgot password error:', 'Method not allowed');
    return createApiResponse(res, 405, undefined, {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are allowed',
    });
  }

  try {

    const { email } = req.body as ForgotPasswordRequest;

    if (!email) {
      return createApiResponse(res, 400, undefined, {
        code: 'MISSING_EMAIL',
        message: 'Email is required',
      });
    }

    // Check if user exists (without revealing if the email exists)
    const supabase = createServerSupabaseClient<Database>({ req, res });
    const { data: userData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    // Always return success to prevent email enumeration
    if (!userData) {
      return createApiResponse(res, 200, {
        message: 'If an account with that email exists, you will receive a password reset link.',
      });
    }

    // Generate password reset token
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      // Still return success to prevent email enumeration
    }

    return createApiResponse(res, 200, {
      message: 'If an account with that email exists, you will receive a password reset link.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    // Return success even on error to prevent email enumeration
    return createApiResponse(res, 200, {
      message: 'If an account with that email exists, you will receive a password reset link.',
    });
  }
}

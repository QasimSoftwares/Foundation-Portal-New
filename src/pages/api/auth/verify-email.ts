import { NextApiRequest, NextApiResponse } from 'next';
import { createApiResponse } from '@/lib/api-utils';
import { VerifyEmailRequest } from '@/types/api';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

// CSRF protection is handled by the middleware
export default async function verifyEmailHandler(
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

    const { token } = req.body as VerifyEmailRequest;

    if (!token) {
      console.error('Email verification error:', 'No token provided');
      return createApiResponse(res, 500, undefined, {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while verifying your email',
      });
    }

    const supabase = createServerSupabaseClient<Database>({ req, res });
    
    // Verify the email using the token
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email',
    });

    if (error) {
      console.error('Email verification error:', error);
      return createApiResponse(res, 400, undefined, {
        code: 'VERIFICATION_FAILED',
        message: 'Failed to verify email. The link may have expired or is invalid.',
      });
    }

    // Update the user's email verification status in the profiles table
    const { error: updateError } = await supabase.rpc('update_email_verification', {
      user_id: data.user?.id,
    });

    if (updateError) {
      console.error('Failed to update email verification status:', updateError);
      // Don't fail the request since the email was verified in auth
    }

    return createApiResponse(res, 200, {
      message: 'Email verified successfully! You can now log in to your account.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return createApiResponse(res, 500, undefined, {
      code: 'EMAIL_VERIFICATION_ERROR',
      message: 'An error occurred while verifying your email. Please try again.'
    });
  }
}

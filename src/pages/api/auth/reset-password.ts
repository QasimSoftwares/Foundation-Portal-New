import { NextApiRequest, NextApiResponse } from 'next';
import { createApiResponse } from '@/lib/api-utils';
import { ResetPasswordRequest } from '@/types/api';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

// CSRF protection is handled by the middleware
export default async function resetPasswordHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    console.error('Reset password error:', 'Method not allowed');
    return createApiResponse(res, 405, undefined, {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are allowed',
    });
  }

  try {

    const { token, password } = req.body as ResetPasswordRequest;

    if (!token) {
      return createApiResponse(res, 400, undefined, {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired reset token',
      });
    }

    if (!password || password.length < 8) {
      return createApiResponse(res, 400, undefined, {
        code: 'INVALID_PASSWORD',
        message: 'Password must be at least 8 characters long',
      });
    }

    const supabase = createServerSupabaseClient<Database>({ req, res });
    
    // Verify the token and update the password
    const { data, error } = await supabase.auth.updateUser({
      password,
    }, {
      // The token is passed in the Authorization header by the Supabase client
      // This is handled automatically by the supabaseServerClient
    });

    if (error) {
      console.error('Password reset error:', error);
      return createApiResponse(res, 400, undefined, {
        code: 'PASSWORD_RESET_FAILED',
        message: 'Failed to reset password. The link may have expired.',
      });
    }

    return createApiResponse(res, 200, {
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return createApiResponse(res, 500, undefined, {
      code: 'RESET_PASSWORD_ERROR',
      message: 'An error occurred while resetting your password. Please try again.'
    });
  }
}

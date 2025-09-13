import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const createClient = () => {
  return createServerComponentClient({ cookies });
};

export const getSession = async () => {
  const supabase = createClient();
  // Get both session and user to maintain backward compatibility
  const [sessionRes, userRes] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser()
  ]);
  
  // If user verification fails, return no session
  if (userRes.error) {
    return { data: { session: null }, error: userRes.error };
  }
  
  // Only return session if user is verified
  if (sessionRes.data.session?.user?.id === userRes.data.user?.id) {
    return sessionRes;
  }
  
  return { data: { session: null }, error: new Error('Session user does not match verified user') };
};

export const getUser = async () => {
  const supabase = createClient();
  return await supabase.auth.getUser();
};

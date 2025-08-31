'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useSupabase } from '@/components/providers/supabase-provider';

export function useAuthRedirect(requireAuth = false) {
  const { session, isLoading } = useSupabase();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoading) return;

    const isAuthPage = pathname.startsWith('/sign') || 
                      pathname.startsWith('/forgot-password') || 
                      pathname.startsWith('/reset-password') ||
                      pathname.startsWith('/verify-email');

    // If user is authenticated but trying to access auth pages, redirect to dashboard
    if (session && isAuthPage) {
      const redirectTo = searchParams.get('redirectTo') || '/dashboard';
      router.replace(redirectTo);
    }
    // If user is not authenticated but trying to access protected route, redirect to sign in
    else if (!session && requireAuth) {
      router.replace(`/signin?redirectTo=${encodeURIComponent(pathname)}`);
    }
  }, [session, isLoading, pathname, searchParams, requireAuth, router]);

  return { session, isLoading };
}

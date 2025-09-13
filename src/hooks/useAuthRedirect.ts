'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getRedirectPathForUser } from '@/lib/security/roles';

export function useAuthRedirect(requireAuth = false) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleRedirect = async () => {
      if (isLoading || !pathname) return;

      const isAuthPage = pathname.startsWith('/sign') ||
                        pathname.startsWith('/forgot-password') ||
                        pathname.startsWith('/reset-password') ||
                        pathname.startsWith('/verify-email');

      // If user is authenticated but trying to access auth pages, redirect to their dashboard
      if (session && isAuthPage) {
        const explicitRedirect = searchParams?.get('redirectTo');
        if (explicitRedirect) {
          router.replace(explicitRedirect);
        } else if (session.user) {
          const redirectPath = await getRedirectPathForUser(session.user.id);
          router.replace(redirectPath);
        }
      }
      // If user is not authenticated but trying to access protected route, redirect to sign in
      else if (!session && requireAuth) {
        const safePathname = pathname || '/';
        router.replace(`/signin?redirectTo=${encodeURIComponent(safePathname)}`);
      }
    };

    handleRedirect();
  }, [session, isLoading, pathname, searchParams, requireAuth, router]);

  return { session, isLoading };
}

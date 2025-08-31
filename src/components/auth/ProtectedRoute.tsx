'use client';

import { ReactNode } from 'react';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Loader2 } from 'lucide-react';

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRole?: string;
  loadingFallback?: ReactNode;
  unauthorizedFallback?: ReactNode;
};

export function ProtectedRoute({
  children,
  requiredRole,
  loadingFallback = (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  ),
  unauthorizedFallback = (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
      <p className="text-gray-600 mb-4">
        You don't have permission to access this page.
      </p>
      <a
        href="/dashboard"
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Back to Dashboard
      </a>
    </div>
  ),
}: ProtectedRouteProps) {
  const { session, isLoading } = useAuthRedirect(true);

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (!session) {
    return null; // useAuthRedirect will handle the redirect
  }

  // Check if user has required role if specified
  if (requiredRole) {
    // TODO: Implement role-based access control
    // For now, just check if user has any role
    const hasRole = session.user?.user_metadata?.role;
    if (!hasRole) {
      return <>{unauthorizedFallback}</>;
    }
  }

  return <>{children}</>;
}

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { getHighestRole, getDashboardPath } from '@/lib/security/roles';

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  syncSession: () => Promise<void>; // Add syncSession to the context type
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  // Track whether we had a session at mount to avoid false SIGNED_IN redirects on token refresh/tab focus
  const hadSessionAtMountRef = useRef<boolean | null>(null);
  const lastKnownUserIdRef = useRef<string | null>(null);

  const signOut = async () => {
    logger.info('Signing out user...');
    
    // Clear role-related storage
    try {
      localStorage.removeItem('active-role');
      sessionStorage.removeItem('pendingRole');
      logger.debug('Cleared role state from storage');
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.warn('Failed to clear role state', { error: errorObj });
    }
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error('Error signing out:', { error });
    } else {
      // The onAuthStateChange listener will handle the session state update
      // and redirect.
      router.push('/signin');
    }
  };

  useEffect(() => {
    // Initially, fetch the session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      hadSessionAtMountRef.current = !!session;
      lastKnownUserIdRef.current = session?.user?.id ?? null;
      logger.debug('AuthProvider initial session loaded.', { hasSession: !!session });
    });

    // Set up the auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.info(`Auth state changed: ${event}`, { hasSession: !!session });
      setSession(session);

      const userId = session?.user?.id ?? null;
      const hadSessionAtMount = hadSessionAtMountRef.current === true;
      const isRealNewLogin = event === 'SIGNED_IN' && (!hadSessionAtMount || !lastKnownUserIdRef.current);
      const isAuthPage = typeof window !== 'undefined' && ['/signin', '/signup', '/'].includes(window.location.pathname);

      // Update last known user id
      lastKnownUserIdRef.current = userId;

      if (event === 'SIGNED_IN' && session?.user) {
        // Only redirect if this is a real sign-in (no session at mount) or we're on an auth page
        if (isRealNewLogin || isAuthPage) {
          try {
            const response = await fetch('/api/roles', {
              credentials: 'include',
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              const roles = data.roles || ['viewer'];
              // Use centralized helpers to determine the correct dashboard path
              const highestRole = getHighestRole(roles);
              const dashboardPath = getDashboardPath(highestRole);
              
              router.push(dashboardPath);
            } else {
              router.push('/dashboard'); // Fallback
            }
          } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to get user roles for redirect');
            logger.error('Error getting user roles for redirect:', { error });
            router.push('/dashboard'); // Fallback
          }
        } else {
          // Do not redirect on token refresh or background sign-in events
          logger.debug('SIGNED_IN event ignored (likely token refresh or background rehydration).');
        }
      } else if (event === 'SIGNED_OUT') {
        // Ensure local storage is cleared and redirect
        router.push('/signin');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const syncSession = async () => {
    logger.debug('Manual session sync requested.');
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    logger.debug('Manual session sync completed.', { hasSession: !!session });
  };

  const value = {
    session,
    isLoading,
    signOut,
    syncSession, // Expose the new function
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

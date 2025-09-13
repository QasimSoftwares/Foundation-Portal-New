'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

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

  const signOut = async () => {
    logger.info('Signing out user...');
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
      logger.debug('AuthProvider initial session loaded.', { hasSession: !!session });
    });

    // Set up the auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.info(`Auth state changed: ${event}`, { hasSession: !!session });
      setSession(session);

      if (event === 'SIGNED_IN' && session?.user) {
        // Handle redirect on sign-in - get user's dashboard path
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
            const highestRole = roles.includes('admin') ? 'admin' : 
                              roles.includes('manager') ? 'manager' : 
                              roles.includes('volunteer') ? 'volunteer' : 'viewer';
            
            const dashboardPath = highestRole === 'admin' ? '/admin/dashboard' :
                                 highestRole === 'manager' ? '/manager/dashboard' :
                                 highestRole === 'volunteer' ? '/volunteer/dashboard' : '/dashboard';
            
            router.push(dashboardPath);
          } else {
            router.push('/dashboard'); // Fallback
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to get user roles for redirect');
          logger.error('Error getting user roles for redirect:', { error });
          router.push('/dashboard'); // Fallback
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

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useCSRFContext } from '@/providers/CSRFProvider';
import createClient from '@/lib/supabase/client';
import { getRedirectPathForUser } from '@/lib/security/roles';

const supabase = createClient();

interface SupabaseContextType {
  supabase: ReturnType<typeof createClient>;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Use the singleton supabase client
  const router = useRouter();
  const { csrfToken } = useCSRFContext();

  const refreshSession = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const { data: { session: newSession }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      // If no session but we were previously authenticated, redirect to sign in
      if (!newSession && user) {
        router.push('/signin');
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const signOut = async (): Promise<void> => {
    try {
      // Clear local state first
      setSession(null);
      setUser(null);

      // Call server-side signout to clear HttpOnly cookies and revoke sessions
      await fetch('/api/auth/signout', { 
        method: 'POST', 
        credentials: 'include',
        headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
      });

      // Also sign out client-side to clear any in-memory state in Supabase client
      await supabase.auth.signOut();

      // Force a full reload to ensure all httpOnly cookies are gone and middleware re-evaluates
      if (typeof window !== 'undefined') {
        window.location.href = '/signin';
      }
    } catch (error) {
      console.error('Error signing out:', error);
      throw error; // Re-throw to be handled by the component
    }
  };

  useEffect(() => {
    // Initial session fetch
    refreshSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setSession(session);
        setUser(session?.user ?? null);

        // Redirect based on auth state changes
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const redirectPath = await getRedirectPathForUser(session.user.id);
            router.push(redirectPath);
          } catch (error) {
            console.error('Error getting redirect path:', error);
            router.push('/dashboard'); // Fallback redirect
          }
        } else if (event === 'SIGNED_OUT') {
          router.push('/signin');
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <SupabaseContext.Provider
      value={{
        supabase,
        session,
        user,
        isLoading,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

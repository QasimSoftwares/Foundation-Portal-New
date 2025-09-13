import { useAuth } from '@/contexts/AuthContext';

export function useUser() {
  const { session, isLoading } = useAuth();
  const user = session?.user ?? null;
  
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

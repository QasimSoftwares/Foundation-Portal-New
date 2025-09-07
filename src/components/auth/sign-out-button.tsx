'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/signin');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <Button 
      variant="outline" 
      className="w-full"
      onClick={handleSignOut}
    >
      Sign Out
    </Button>
  );
}

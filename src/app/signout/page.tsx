'use client';

import { useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function SignOutPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const signOut = async () => {
      try {
        // Sign out from Supabase (server clears HttpOnly cookies)
        await supabase.auth.signOut();

        // Redirect to sign-in page
        router.replace('/signin'); // use replace to avoid back navigation
      } catch (error) {
        console.error('Error during sign out:', error);
        router.replace('/signin');
      }
    };

    signOut();
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-lg text-gray-700 mb-4">Signing out...</p>
        <div className="flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      </div>
    </div>
  );
}

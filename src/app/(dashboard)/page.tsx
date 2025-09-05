'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabase } from '@/components/providers/supabase-provider';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Loader2 } from 'lucide-react';

// Wrap the main component in a Suspense boundary
function DashboardContent() {
  const { session, isLoading } = useSupabase();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/signin');
    }
  }, [isLoading, session, router]);

  // Show loading state while checking auth
  if (isLoading || isSigningOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Don't render anything if not authenticated
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back, {session.user.email?.split('@')[0] || 'User'}!</h1>
            <p className="text-gray-600">Here's what's happening with your account today.</p>
          </div>
          <button 
            onClick={async (e) => {
              e.preventDefault();
              setIsSigningOut(true);
            
              try {
                // Sign out from Supabase (clears server-side HttpOnly cookies)
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
            
                // Redirect to signin page
                router.replace('/signin');
              } catch (error) {
                console.error('Error during sign out:', error);
                setIsSigningOut(false);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Info Card */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-lg mb-4">Account Information</h3>
            <div className="space-y-2">
              <p><span className="font-medium">Email:</span> {session.user.email}</p>
              <p><span className="font-medium">Last Sign In:</span> {new Date(session.user.last_sign_in_at || '').toLocaleString()}</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-lg mb-4">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <p className="text-sm text-gray-500">Total Donations</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <p className="text-sm text-gray-500">Active Campaigns</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
                Update Profile
              </button>
              <button className="w-full text-left p-3 bg-green-50 rounded-md hover:bg-green-100 transition-colors">
                View Reports
              </button>
              <button className="w-full text-left p-3 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors">
                Create New Donation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        
        {/* Recent Activity */}
        <div className="mt-8 w-full max-w-4xl bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-lg mb-4">Loading Dashboard...</h3>
          <div className="text-center py-8 text-gray-500">
            <p>Please wait while we load your dashboard</p>
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

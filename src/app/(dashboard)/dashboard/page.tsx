'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabase } from '@/components/providers/supabase-provider';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user, signOut } = useSupabase();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/signin');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button onClick={handleSignOut} variant="outline">
          Sign Out
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Welcome back, {user?.user_metadata?.full_name || 'User'}!</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><span className="font-medium">Email:</span> {user?.email}</p>
              <p><span className="font-medium">Role:</span> {user?.user_metadata?.role || 'Viewer'}</p>
              <p><span className="font-medium">Status:</span> {user?.user_metadata?.verification_status || 'Pending'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => router.push('/profile')}>
              View Profile
            </Button>
            <Button className="w-full" variant="outline" onClick={() => router.push('/settings')}>
              Account Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

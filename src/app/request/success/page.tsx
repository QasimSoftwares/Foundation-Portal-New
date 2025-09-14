'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function RequestSuccessPage() {
  const router = useRouter();
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border rounded-lg p-8 text-center space-y-4">
        <h1 className="text-2xl font-semibold">Request submitted successfully</h1>
        <p className="text-gray-600">We'll notify you once an admin reviews your request.</p>
        <div className="pt-2">
          <Button onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
        </div>
      </div>
    </div>
  );
}

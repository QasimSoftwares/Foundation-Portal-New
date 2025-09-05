'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, CheckCircle, Loader2, Mail as MailIcon } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { fetchWithCSRF } from '@/lib/http/csrf-interceptor';

type VerificationStatus = 'verifying' | 'success' | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();

  const handleResendVerification = async () => {
    const email = searchParams?.get('email');
    if (!email) {
      toast({
        title: 'Error',
        description: 'Email address is required to resend verification.',
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    try {
      const response = await fetchWithCSRF('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to resend verification email');
      }

      toast({
        title: 'Verification email sent',
        description: 'Please check your email for the verification link.',
      });
    } catch (error) {
      console.error('Error resending verification email:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resend verification email',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams?.get('token');
      const type = searchParams?.get('type');
      const email = searchParams?.get('email');

      if (!token || !type) {
        setStatus('error');
        setError('Invalid verification link. Please check the link or request a new one.');
        return;
      }

      try {
        const response = await fetchWithCSRF('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, type, email }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Failed to verify email');
        }
        
        setStatus('success');
        
        toast({
          title: 'Email verified!',
          description: 'Your email has been successfully verified. Redirecting you to the sign in page...',
        });
        
        // Redirect to signin after a short delay
        setTimeout(() => {
          router.push('/signin?verified=true');
        }, 3000);
      } catch (error) {
        console.error('Error verifying email:', error);
        setStatus('error');
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'An error occurred while verifying your email. Please try again.';
        
        setError(errorMessage);
        
        toast({
          title: 'Verification failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    };

    verifyEmail();
  }, [searchParams, toast, router]);

  if (status === 'verifying') {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8 text-center">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Verifying your email
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we verify your email address...
            </p>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (status === 'error') {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-red-100 p-3">
                  <AlertCircle className="h-12 w-12 text-red-600" />
                </div>
              </div>
              <h2 className="mt-6 text-2xl font-bold text-gray-900">
                Verification failed
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {error || 'There was a problem verifying your email.'}
              </p>
            </div>
            
            <div className="space-y-4">
              <Link href="/signin" className="block w-full">
                <Button className="w-full">
                  Back to sign in
                </Button>
              </Link>
              
              <Button 
                variant="outline"
                className="w-full"
                onClick={handleResendVerification}
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Resend verification email'
                )}
              </Button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Success state
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Email verified successfully!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your email has been verified. Redirecting you to the sign in page...
          </p>
          <div className="mt-6">
            <Link href="/signin" className="w-full">
              <Button className="w-full max-w-xs">
                Go to sign in
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

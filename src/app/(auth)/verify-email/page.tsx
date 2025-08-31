'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, CheckCircle, Loader2, MailCheck } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/error/ErrorFallback';

type VerificationStatus = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();
  const supabase = createClientComponentClient();

  const handleResendVerification = async () => {
    const email = searchParams.get('email');
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
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (resendError) throw resendError;

      toast({
        title: 'Verification email resent',
        description: 'Please check your email for the verification link.',
        variant: 'default',
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
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      const email = searchParams.get('email');

      if (!token || !type) {
        setStatus('error');
        setError('Invalid verification link. Please check the link or request a new one.');
        return;
      }

      try {
        const { error: verificationError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as any, // 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change'
        });

        if (verificationError) throw verificationError;
        
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
  }, [searchParams, toast, supabase]);

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

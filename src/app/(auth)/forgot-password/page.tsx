'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, Mail, CheckCircle } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/error/ErrorFallback';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type FormData = z.infer<typeof formSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClientComponentClient();

  // Fetch CSRF token on component mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/auth/csrf-token');
        const data = await response.json();
        setCsrfToken(data.csrfToken);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        toast({
          title: 'Error',
          description: 'Failed to load security token. Please refresh the page.',
          variant: 'destructive',
        });
      }
    };

    fetchCsrfToken();
  }, [toast]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (formData: FormData) => {
    if (!csrfToken || !isInitialized) {
      toast({
        title: 'Security Error',
        description: 'Security token not loaded. Please refresh the page and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          email: formData.email,
          _csrf: csrfToken,
        }),
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          // CSRF token validation failed - refresh token and retry once
          const refreshResponse = await fetch('/api/auth/csrf-token');
          const { csrfToken: newToken } = await refreshResponse.json();
          if (newToken) {
            setCsrfToken(newToken);
            // Retry with new token
            return onSubmit(formData);
          }
          throw new Error('Session expired. Please refresh the page and try again.');
        } else if (response.status === 429) {
          // Rate limit exceeded
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(
            `Too many attempts. ${retryAfter ? `Please try again in ${retryAfter} seconds.` : 'Please try again later.'}`
          );
        }
        throw new Error(result.error?.message || 'Failed to send reset email');
      }
      
      setEmailSent(true);
      
      toast({
        title: 'Email sent',
        description: 'Check your email for a link to reset your password.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error sending reset password email:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send reset email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <Loader2 className="mx-auto h-12 w-12 text-indigo-600 animate-spin" />
          <p className="mt-2 text-sm text-gray-600">Loading security token...</p>
        </div>
      </div>
    );
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="flex justify-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            We've sent a password reset link to your email address.
          </p>
          <div className="mt-6">
            <p className="text-sm text-gray-600">
              Didn't receive an email?{' '}
              <button
                onClick={() => {
                  setEmailSent(false);
                  form.reset();
                }}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Try again
              </button>
            </p>
            <div className="mt-4">
              <Link
                href="/signin"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        form.reset();
      }}
    >
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Reset your password
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter your email and we'll send you a link to reset your password.
            </p>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
              <div className="rounded-md shadow-sm -space-y-px">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                          className="pl-10"
                          type="email"
                          placeholder="example@email.com"
                          {...field}
                          disabled={isLoading || !isInitialized}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
              </div>
              
              <div className="text-center">
                <Link
                  href="/signin"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </ErrorBoundary>
  );
}

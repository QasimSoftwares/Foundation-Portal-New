'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, Lock, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { passwordSchema } from '@/lib/security/passwordUtils';

const formSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isValidLink, setIsValidLink] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
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

  // Check if the reset link is valid
  useEffect(() => {
    const checkResetLink = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) throw error;
        setIsValidLink(true);
      } catch (error) {
        console.error('Invalid or expired reset link:', error);
        setIsValidLink(false);
      }
    };

    checkResetLink();
  }, [searchParams]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: FormData) => {
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
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          password: values.password,
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
            return onSubmit(values);
          }
          throw new Error('Session expired. Please refresh the page and try again.');
        } else if (response.status === 429) {
          // Rate limit exceeded
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(
            `Too many attempts. ${retryAfter ? `Please try again in ${retryAfter} seconds.` : 'Please try again later.'}`
          );
        }
        throw new Error(result.error?.message || 'Failed to reset password');
      }
      
      // Show success message
      toast({
        title: 'Password updated',
        description: 'Your password has been updated successfully.',
        variant: 'default',
      });

      // Redirect to signin page
      router.push('/signin?password_reset=true');
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized || isValidLink === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <Loader2 className="mx-auto h-12 w-12 text-indigo-600 animate-spin" />
          <p className="mt-2 text-sm text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (!isValidLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="flex justify-center">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Invalid or expired link
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            The password reset link is invalid or has expired. Please request a new one.
          </p>
          <div className="mt-6">
            <Link
              href="/forgot-password"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Request new link
            </Link>
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
              Enter your new password below.
            </p>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
              <div className="rounded-md shadow-sm -space-y-px">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                          className="pl-10 pr-10"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...field}
                          disabled={isLoading || !isInitialized}
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      <FormMessage />
                      {field.value && (
                        <PasswordStrengthIndicator 
                          password={field.value} 
                          className="mt-2" 
                        />
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                          className="pl-10 pr-10"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...field}
                          disabled={isLoading || !isInitialized}
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
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
                      Updating password...
                    </>
                  ) : (
                    'Update password'
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

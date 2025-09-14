'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { Lock as LockIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithCSRF } from '@/lib/http/csrf-interceptor';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Mail, User, Eye, EyeOff } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { passwordSchema } from '@/lib/security/passwordUtils';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

function SignUpContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClientComponentClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      // CSRF preflight: if the CSRF cookie is missing, issue a HEAD request to
      // prime it via middleware before the credentialed POST. This avoids the
      // "first request only sets CSRF" handshake requiring a second submit.
      const hasCSRFCookie = typeof document !== 'undefined' && document.cookie.includes('sb-csrf-token=');
      if (!hasCSRFCookie) {
        try {
          await fetch(window.location.pathname, {
            method: 'HEAD',
            credentials: 'include',
          });
          // small delay to let the browser commit Set-Cookie
          await new Promise((r) => setTimeout(r, 75));
        } catch (e) {
          // Non-fatal: continue to attempt sign-up
          console.warn('CSRF preflight failed, continuing to sign-up', e);
        }
      }

      const response = await fetchWithCSRF('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          acceptTerms: data.acceptTerms,
        }),
        credentials: 'include',
      });

      const result = await response.json().catch(() => ({} as any));

      if (!response.ok) {
        if (response.status === 403) {
          // CSRF token is invalid or missing; reload to obtain a fresh token
          window.location.reload();
          return;
        } else if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(
            `Too many attempts. ${retryAfter ? `Please try again in ${retryAfter} seconds.` : 'Please try again later.'}`
          );
        }
        throw new Error((result as any)?.message || (result as any)?.error?.message || 'Failed to create account');
      }

      // Show success message using the toast function from the hook
      if (toast) {
        toast({
          title: 'Success',
          description: 'Account created successfully! Please check your email to verify your account.',
        });
      }

      // Redirect to verify email page with the user's email as a query parameter
      router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (error) {
      console.error('Signup error:', error);
      if (toast) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to create account',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="flex flex-col items-center justify-start px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-4 mt-8">
          {/* Logo and Welcome Message */}
          <div className="text-center">
            <div className="w-20 h-20 relative mx-auto flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Family And Fellows Foundation Logo"
                width={80}
                height={80}
                className="w-auto h-auto max-w-full max-h-full object-contain"
                priority
                style={{ width: 'auto', height: 'auto' }}
              />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Join our community today
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <User className="h-5 w-5 text-gray-400" />
                          </div>
                          <Input
                            type="text"
                            placeholder="John Doe"
                            className="pl-10"
                            disabled={isLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Mail className="h-5 w-5 text-gray-400" />
                          </div>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            className="pl-10"
                            disabled={isLoading}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <LockIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="pl-10"
                            autoComplete="new-password"
                            disabled={isLoading}
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                            suppressHydrationWarning
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5 text-gray-400" />
                            ) : (
                              <Eye className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <PasswordStrengthIndicator password={form.watch('password')} />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <LockIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="pl-10"
                            autoComplete="new-password"
                            disabled={isLoading}
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                            suppressHydrationWarning
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5 text-gray-400" />
                            ) : (
                              <Eye className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 pt-2">
                  <FormField
                    control={form.control}
                    name="acceptTerms"
                    render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 rounded-md">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="h-4 w-4 mt-1 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm text-gray-600">
                            I agree to the{' '}
                            <Link href="/terms" className="text-brand-blue hover:underline">
                              Terms of Service
                            </Link>{' '}
                            and{' '}
                            <Link href="/privacy" className="text-brand-blue hover:underline">
                              Privacy Policy
                            </Link>
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-brand-blue hover:bg-blue-700 transition-colors duration-200"
                    disabled={isLoading}
                    suppressHydrationWarning
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </div>
                <p className="text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link href="/signin" className="font-medium text-brand-blue hover:text-blue-700 transition-colors duration-200">
                    Sign in here
                  </Link>
                </p>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}

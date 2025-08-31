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
import { Loader2, AlertCircle, Mail, Lock, User, Phone, CreditCard, Eye, EyeOff } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { passwordSchema } from '@/lib/security/passwordUtils';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: passwordSchema,
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phoneNumber: z.string().min(10, 'Please enter a valid phone number'),
  cnicNumber: z.string().min(13, 'CNIC must be 13 digits'),
});

type FormData = z.infer<typeof formSchema>;

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClientComponentClient();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

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
          description: 'Failed to initialize security token. Please refresh the page.',
          variant: 'destructive',
        });
      } finally {
        setIsInitialized(true);
      }
    };

    fetchCsrfToken();
  }, [toast]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      phoneNumber: '',
      cnicNumber: '',
    },
  });

  const refreshCsrfToken = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/csrf-token');
      const data = await response.json();
      setCsrfToken(data.csrfToken);
      return data.csrfToken;
    } catch (error) {
      console.error('Failed to refresh CSRF token:', error);
      return null;
    }
  };

  const onSubmit = async (formValues: FormData) => {
    if (!csrfToken || !isInitialized) {
      toast({
        title: 'Error',
        description: 'Security token not loaded. Please refresh the page and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Sign up the user with Supabase
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          ...formValues,
          _csrf: csrfToken,
        }),
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          // CSRF token validation failed - refresh token and retry once
          const newToken = await refreshCsrfToken();
          if (newToken) {
            // Retry with new token
            return onSubmit(formValues);
          }
          throw new Error('Session expired. Please refresh the page and try again.');
        } else if (response.status === 429) {
          // Rate limit exceeded
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(
            `Too many attempts. ${retryAfter ? `Please try again in ${retryAfter} seconds.` : 'Please try again later.'}`
          );
        }
        throw new Error(result.error?.message || 'Failed to sign up');
      }
      
      // Show success message
      toast({
        title: 'Success',
        description: 'Please check your email to verify your account',
        variant: 'default',
      });

      // Redirect to signin page with success state
      router.push('/signin?registered=true');
    } catch (error) {
      console.error('Error signing up:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sign up. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-500" />
          <p className="mt-2 text-sm text-gray-500">Loading security settings...</p>
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
              Create a new account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Or{' '}
              <Link href="/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
                sign in to your existing account
              </Link>
            </p>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
              <div className="rounded-md shadow-sm -space-y-px">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                          className="pl-10"
                          placeholder="John Doe"
                          {...field}
                          disabled={isLoading}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="your@email.com"
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
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                            disabled={isLoading}
                            {...field}
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
                      </FormControl>
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
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <Input
                            type="tel"
                            placeholder="+92 3XX XXXXXXX"
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
                  name="cnicNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNIC Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <Input
                            placeholder="XXXXXXXXXXXXX"
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
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : 'Sign up'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </ErrorBoundary>
  );
}

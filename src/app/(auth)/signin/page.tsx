'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { fetchWithCSRF } from '@/lib/http/csrf-interceptor';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/error/ErrorFallback';

// Form validation schema
const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignInFormData = z.infer<typeof signInSchema>;

function SignInContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { syncSession } = useAuth();
  // Only use callbackUrl if it's a relative path to prevent open redirects
  const callbackUrl = (() => {
    const url = searchParams?.get('callbackUrl') || '';
    return url && url.startsWith('/') ? url : '/dashboard';
  })();
  
  // The CSRF token is automatically handled by the fetchWithCSRF wrapper

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setLoginError(null); // Clear previous errors
    const toastId = toast.loading('Signing in...');
    console.log('Starting sign in...', { email: data.email });
    
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
          // Non-fatal: continue to attempt sign-in
          console.warn('CSRF preflight failed, continuing to sign-in', e);
        }
      }

      console.log('Making sign-in request...');
      const response = await fetchWithCSRF('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include', // Important for cookies
      });

      console.log('Response status:', response.status);
      const responseData = await response.json().catch(() => ({}));
      console.log('Response data:', responseData);
      
      if (!response.ok) {
        console.error('Sign in failed:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        if (response.status === 403) {
          console.log('CSRF token invalid, reloading page...');
          // CSRF token is invalid, refresh the page to get a new one
          window.location.reload();
          return;
        } else if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(
            `Too many attempts. ${retryAfter ? `Please try again in ${retryAfter} seconds.` : 'Please try again later.'}`
          );
        } else {
          // Handle different error cases with user-friendly messages
          const errorMessage = responseData?.error?.message || 'Sign in failed';
          const errorCode = responseData?.error?.code || 'UNKNOWN_ERROR';
          
          // Map error codes to user-friendly messages
          const errorMessages: Record<string, string> = {
            'INVALID_CREDENTIALS': 'Email or password is incorrect. Please try again.',
            'EMAIL_NOT_CONFIRMED': 'Please verify your email before signing in. Check your inbox for a verification link.',
            'INVALID_EMAIL': 'The email address is not valid. Please check and try again.',
            'WEAK_PASSWORD': 'The password is too weak. It must be at least 6 characters long.',
            'TOO_MANY_REQUESTS': 'Too many sign-in attempts. Please try again later.',
            'DEFAULT': 'An error occurred during sign in. Please try again.'
          };
          
          // Get the appropriate error message or fall back to the server message
          const userFriendlyMessage = errorMessages[errorCode] || errorMessages['DEFAULT'];
          
          // Create a new error with the user-friendly message
          const error = new Error(userFriendlyMessage);
          // Set the login error state
          setLoginError(userFriendlyMessage);
          // Attach the original error code for debugging
          (error as any).code = errorCode;
          throw error;
        }
      }
      
      console.log('Sign in successful...');
      // Show success message
      toast.success('You have been signed in successfully', { id: toastId });


      const apiDashboardPath = (responseData as any)?.dashboard;
      const finalRedirectPath = (apiDashboardPath && apiDashboardPath.startsWith('/')) ? apiDashboardPath : callbackUrl;

      // Manually set the session on the client to immediately trigger the AuthProvider's listener.
      // This is critical for the first sign-in to ensure the session is available before navigating.
      const sessionTokens = (responseData as any)?.session;
      if (sessionTokens?.access_token && sessionTokens?.refresh_token) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: sessionTokens.access_token,
          refresh_token: sessionTokens.refresh_token,
        });
        if (setSessionError) {
          // Log the error but don't block the redirect, as the cookies are still set.
          console.error('Failed to set Supabase client session', { error: setSessionError });
        }
      } else {
        console.warn('No session tokens returned from API to set client session');
      }

      // Manually set the session to trigger the AuthProvider's onAuthStateChange listener
      // which will handle the redirect automatically
      await syncSession(); // This will trigger SIGNED_IN event and automatic redirect
    } catch (error: unknown) {
      console.error('Sign in error:', error);
      let errorMessage = 'An unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      } else if (typeof error === 'object' && error !== null) {
        // Handle other error-like objects
        const errorObj = error as Record<string, unknown>;
        errorMessage = String(errorObj.message || errorMessage);
        console.error('Error details:', error);
      }
      
      toast.error(`Sign in failed: ${errorMessage}`, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-[360px] mx-auto">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex flex-col items-center justify-center space-y-4 h-64">
            <Loader2 className="h-12 w-12 text-brand-blue animate-spin" />
            <p className="text-sm text-gray-600">Signing in...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex flex-col items-center space-y-4 mb-8">
        <div className="w-24 h-24 relative flex items-center justify-center">
          <Image 
            src="/logo.png" 
            alt="Family And Fellows Foundation Logo" 
            width={96}
            height={96}
            className="w-auto h-auto max-w-full max-h-full object-contain"
            priority
            style={{ width: 'auto', height: 'auto' }}
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          Welcome to Family And Fellows Foundation Portal
        </h1>
      </div>
      <div className="bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-xl border border-gray-100">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
        </div>
        
        {/* Error message display */}
        {loginError && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{loginError}</p>
              </div>
            </div>
          </div>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <FormControl>
                        <Input
                          placeholder="name@example.com"
                          type="email"
                          className="pl-10"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-sm font-medium text-brand-blue hover:text-blue-700 transition-colors duration-200"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="••••••••"
                            type={showPassword ? "text" : "password"}
                            className="pl-10 pr-10"
                            autoComplete="current-password"
                            {...field}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
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
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-6">
              <Button
                type="submit"
                className="w-full py-2.5 text-sm font-medium rounded-lg shadow-sm text-white bg-brand-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue/50 disabled:opacity-50 transition-colors duration-200"
                disabled={isLoading}
                suppressHydrationWarning
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </div>
            
            <div className="mt-4 text-center text-sm">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-brand-blue hover:text-blue-700 transition-colors duration-200">
                Sign up
              </Link>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
function SignInPage() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }>
        <SignInContent />
      </Suspense>
    </ErrorBoundary>
  );
}

export default SignInPage;

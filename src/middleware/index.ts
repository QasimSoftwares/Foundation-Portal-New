import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { nextRateLimit } from './nextRateLimit';

// Security headers configuration
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; ')
};

// Route configurations
const ROUTE_CONFIG = {
  public: {
    exact: ['/', '/api/health'],
    startsWith: ['/_next', '/static', '/api/auth/', '/auth/']
  },
  protected: {
    startsWith: ['/dashboard', '/api/dashboard', '/profile', '/api/profile', '/settings', '/api/settings']
  },
  sensitive: {
    exact: [
      '/api/auth/signin',
      '/api/auth/signup',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/verify-email'
    ]
  }
};

// Rate limit configurations
const RATE_LIMITS = {
  default: { limit: 100, window: 60 }, // 100 requests per minute
  sensitive: { limit: 10, window: 60 }, // 10 requests per minute for auth
  strict: { limit: 5, window: 60 } // 5 requests per minute for critical paths
};

// Helper functions
const isPublicRoute = (pathname: string): boolean => {
  return (
    ROUTE_CONFIG.public.exact.includes(pathname) ||
    ROUTE_CONFIG.public.startsWith.some(prefix => pathname.startsWith(prefix))
  );
};

const isProtectedRoute = (pathname: string): boolean => {
  return ROUTE_CONFIG.protected.startsWith.some(prefix => pathname.startsWith(prefix));
};

const isSensitiveEndpoint = (pathname: string): boolean => {
  return ROUTE_CONFIG.sensitive.exact.includes(pathname);
};

// Create Supabase client for middleware
const createClient = (request: NextRequest) => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
};

// CSRF token validation
function validateCSRFToken(token: string | null): boolean {
  // TODO: Implement proper CSRF token validation
  // This should verify the token against the user's session
  return !!token;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Apply security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    return response;
  }

  // Apply rate limiting
  const rateLimitConfig = isSensitiveEndpoint(pathname) 
    ? RATE_LIMITS.sensitive 
    : RATE_LIMITS.default;

  // Create rate limit middleware with appropriate config
  const rateLimitMiddleware = nextRateLimit({
    maxAttempts: rateLimitConfig.limit,
    windowMs: rateLimitConfig.window * 1000, // Convert to milliseconds
    keyGenerator: (req) => `${req.ip || 'unknown'}:${req.nextUrl.pathname}`
  });

  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request);
  if (rateLimitResponse) {
    // If rate limited, return the rate limit response
    return rateLimitResponse;
  }

  // Check authentication for protected routes
  if (isProtectedRoute(pathname)) {
    const supabase = createClient(request);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      const url = new URL('/signin', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }

    // Add user to request headers for API routes
    if (pathname.startsWith('/api/')) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        requestHeaders.set('x-user-id', user.id);
        requestHeaders.set('x-user-email', user.email || '');
        
        // Get user roles from database if needed
        const { data: userData } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (userData) {
          requestHeaders.set('x-user-roles', JSON.stringify(userData));
        }
      }
    }
  }

  // Apply CSRF protection for state-changing requests
  const csrfExemptMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (!csrfExemptMethods.includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token') || 
                     request.nextUrl.searchParams.get('_csrf');
                     
    if (!validateCSRFToken(csrfToken)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid CSRF token',
          message: 'Please refresh the page and try again.'
        }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            ...SECURITY_HEADERS
          } 
        }
      );
    }
  }

  return response;
}

// Apply middleware to all routes except static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};

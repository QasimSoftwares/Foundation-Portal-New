import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { withCSRFProtection, attachCSRFToken } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import { ROUTE_CONFIG, SECURITY_HEADERS, RATE_LIMIT_CONFIG } from '@/config/routes';

// In-memory store for rate limiting (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Helper functions for route matching
const isPublicRoute = (pathname: string): boolean => {
  return (
    ROUTE_CONFIG.public.exact.includes(pathname as any) ||
    ROUTE_CONFIG.public.startsWith.some(prefix => pathname.startsWith(prefix))
  );
};

const isProtectedRoute = (pathname: string): boolean => {
  return ROUTE_CONFIG.protected.startsWith.some(prefix => pathname.startsWith(prefix));
};

const isSensitiveEndpoint = (pathname: string): boolean => {
  return ROUTE_CONFIG.sensitive.exact.includes(pathname as any);
};

const isAdminRoute = (pathname: string): boolean => {
  return ROUTE_CONFIG.admin.startsWith.some(prefix => pathname.startsWith(prefix));
};

// Rate limiting middleware
const rateLimit = (request: NextRequest): { isRateLimited: boolean; response?: NextResponse } => {
  // Get client IP from headers or default to localhost
  const ip = (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for') ||
    '127.0.0.1'
  ).split(',')[0].trim();
  const ua = request.headers.get('user-agent') || 'unknown-ua';
  const uaKey = Buffer.from(ua).toString('base64').slice(0, 16);
  const pathname = request.nextUrl.pathname;
  const now = Date.now();
  
  // Get rate limit config based on route type
  let config = RATE_LIMIT_CONFIG.default;
  if (isSensitiveEndpoint(pathname)) {
    config = RATE_LIMIT_CONFIG.sensitive;
  } else if (pathname.startsWith('/api/')) {
    config = RATE_LIMIT_CONFIG.publicApi;
  }
  
  const key = `${ip}:${uaKey}:${pathname}`;
  const record = rateLimitStore.get(key);
  
  if (record) {
    if (now < record.resetTime) {
      // Within rate limit window
      if (record.count >= config.limit) {
        // Rate limit exceeded
        const response = new NextResponse('Too Many Requests', { status: 429 });
        response.headers.set('Retry-After', String(Math.ceil((record.resetTime - now) / 1000)));
        response.headers.set('X-RateLimit-Limit', String(config.limit));
        response.headers.set('X-RateLimit-Remaining', '0');
        response.headers.set('X-RateLimit-Reset', String(record.resetTime));
        
        logger.warn('Rate limit exceeded', {
          ip,
          pathname,
          limit: config.limit,
          windowMs: config.windowMs,
        });
        
        return { isRateLimited: true, response };
      }
      // Increment counter
      rateLimitStore.set(key, { ...record, count: record.count + 1 });
    } else {
      // Reset counter
      rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    }
  } else {
    // First request
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
  }
  
  return { isRateLimited: false };
};

// Apply security headers to response
const applySecurityHeaders = (response: NextResponse): void => {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
};

// Main request handler
async function handleRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  try {
    // Skip middleware for static files and API routes
    if (pathname.startsWith('/_next/') || 
        pathname.startsWith('/static/') || 
        pathname.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg)$/)) {
      return NextResponse.next();
    }

    // Create a response object
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // Apply security headers
    applySecurityHeaders(response);

    // Check rate limiting for non-public routes
    if (!isPublicRoute(pathname)) {
      const rateLimitResult = rateLimit(request);
      if (rateLimitResult.isRateLimited) {
        return rateLimitResult.response || new NextResponse('Too Many Requests', { status: 429 });
      }
    }

    // Skip session check for public routes
    if (isPublicRoute(pathname)) {
      return response;
    }

    // Create Supabase client with proper cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              httpOnly: true,
              maxAge: 0,
            });
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
              path: '/',
              maxAge: 0,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              httpOnly: true,
            });
          },
        },
      }
    );

    // Get session once
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.error('Error getting session', sessionError, { pathname });
      return new NextResponse('Internal Server Error', { status: 500 });
    }

    // Check if user is authenticated for protected routes
    if (isProtectedRoute(pathname) || isAdminRoute(pathname)) {
      if (!session) {
        // For API routes, return 401 instead of redirecting
        if (pathname.startsWith('/api/')) {
          return new NextResponse(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // For pages, redirect to sign-in with the current path as the return URL
        const signInUrl = new URL('/signin', request.url);
        signInUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(signInUrl);
      }
    }

    // Handle admin routes
    if (isAdminRoute(pathname) && session) {
      // Use RPC to check admin status
      const { data: adminCheck, error: adminCheckError } = await supabase.rpc('is_user_admin', { 
        p_user_id: session.user.id 
      });
      
      // Get the first result (if any)
      const isAdmin = Array.isArray(adminCheck) ? adminCheck[0]?.is_admin : false;

      if (adminCheckError || !isAdmin) {
        logger.warn('Unauthorized admin access attempt', { 
          userId: session.user.id, 
          pathname,
          error: adminCheckError?.message
        });
        return new NextResponse('Forbidden', { status: 403 });
      }
    }

    // Handle signin redirect
    if (session && pathname.startsWith('/signin')) {
      const redirectTo = new URL(
        request.nextUrl.searchParams.get('redirectTo') || '/dashboard',
        request.url
      );
      logger.info('Redirecting to dashboard', { 
        userId: session.user.id, 
        pathname 
      });
      return NextResponse.redirect(redirectTo);
    }

    return response;
  } catch (error) {
    logger.error('Middleware error', error as Error, { pathname });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Apply CSRF protection and token handling
export const middleware = withCSRFProtection(attachCSRFToken(handleRequest));

// Configure which paths this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - exclude asset extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|_next/data|_next/webpack-hmr|.*\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
};



import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { 
  withCSRFProtection, 
  attachCSRFToken, 
  generateAndSetCSRFToken,
  getCSRFTokenFromRequest
} from '@/lib/security/csrf';
// Logger instance for middleware
const logger = {
  info: (message: string, meta: Record<string, any> = {}) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta }));
  },
  warn: (message: string, meta: Record<string, any> = {}) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta }));
  },
  error: (message: string, error?: Error, meta: Record<string, any> = {}) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message,
      stack: error?.stack,
      ...meta
    }));
  }
};

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

// Get client IP from request headers
function getClientIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    undefined
  );
}

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

// Rate limiting is handled by the centralized rate limiter

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
export const createClient = (request: NextRequest) => {
  return {
    supabase: createServerClient(
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
    )
  };
};

// Import the proper CSRF validation function
import { validateCSRFToken as validateToken } from '@/lib/security/csrf';

// Re-export the CSRF token validation function
const validateCSRFToken = (token: string | null, request: NextRequest): boolean => {
  const sessionToken = request.cookies.get('sb-csrf-token')?.value || null;
  return validateToken(token, sessionToken);
};

async function handleRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Generate and set CSRF token if it doesn't exist
  if (!request.cookies.get('sb-csrf-token')) {
    generateAndSetCSRFToken(response);
  }
  
  // Add security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });


  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    return response;
  }

  // Rate limiting is handled by the centralized rate limiter

  // Check authentication 
  if (isProtectedRoute(pathname)) {
    const { supabase } = createClient(request);
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      const redirectUrl = new URL('/signin', request.url);
      redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Add user to request headers for API routes
  if (pathname.startsWith('/api/')) {
    const { supabase } = createClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-email', user.email || '');
      
      // Get user roles from database if needed
      const { data: userData, error: userDataError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (userData && !userDataError) {
        requestHeaders.set('x-user-roles', JSON.stringify(userData));
      }
    }
  }

  // CSRF protection is now handled by the withCSRFProtection wrapper

  return response;
}

// Authentication middleware
export const withAuth = (handler: (req: NextRequest) => Promise<NextResponse>) => {
  return async (req: NextRequest) => {
    const { supabase } = createClient(req);
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return NextResponse.redirect(new URL('/signin', req.url));
    }

    return handler(req);
  };
};

// Require admin role middleware
export const requireAdmin = (handler: (req: NextRequest) => Promise<NextResponse>) => {
  return withAuth(async (req) => {
    const { supabase } = createClient(req);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.redirect(new URL('/signin', req.url));
    }

    // Check if user has admin role using RPC
    const { data: adminCheck, error: adminCheckError } = await supabase
      .rpc('check_user_admin', { p_user_id: session.user.id });
      
    // Get the first result (if any)
    const isAdmin = Array.isArray(adminCheck) ? adminCheck[0]?.is_admin === true : false;
    
    if (adminCheckError || !isAdmin) {
      logger.warn('Admin access denied', { 
        userId: session.user.id, 
        error: adminCheckError?.message 
      });
      return new NextResponse('Forbidden', { status: 403 });
    }

    return handler(req);
  });
};

// Require specific permission middleware
export const requirePermission = (permission: string) => {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    return withAuth(async (req) => {
      const { supabase } = createClient(req);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return NextResponse.redirect(new URL('/signin', req.url));
      }

      // Check if user has the required permission using RPC
      const { data: permissionCheck, error: permCheckError } = await supabase
        .rpc('check_user_permission', { 
          p_user_id: session.user.id,
          p_permission: permission 
        });
        
      // Get the first result (if any)
      const hasPermission = Array.isArray(permissionCheck) ? 
        permissionCheck[0]?.has_permission === true : false;
      
      if (permCheckError || !hasPermission) {
        logger.warn('Permission check failed', { 
          userId: session.user.id, 
          permission,
          error: permCheckError?.message 
        });
        return new NextResponse('Forbidden', { status: 403 });
      }

      return handler(req);
    });
  };
};

// Main middleware function with CSRF protection
export const middleware = withCSRFProtection(attachCSRFToken(handleRequest as any));

// Apply middleware to all routes except static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};

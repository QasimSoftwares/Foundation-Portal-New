import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { withCSRFProtection, attachCSRFToken } from '@/lib/security/csrf';
import { logger } from '@/lib/utils/logger';
import { ROUTE_CONFIG, SECURITY_HEADERS } from '@/config/routes';
import { 
  fetchUserRoles, 
  isAdmin, 
  type UserRole, 
  getHighestRole, 
  getDashboardPath,
  hasAtLeastRole,
  hasRole,
  isValidRole
} from '@/lib/security/roles';
import { rateLimit } from '@/lib/security/rateLimit';

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

// Apply security headers to response
const applySecurityHeaders = (response: NextResponse): void => {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
};

// Main request handler
// Track redirects to prevent loops
const MAX_REDIRECTS = 3;

async function handleRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  
  // Skip logging for static assets and known paths that get hit frequently
  const shouldSkipLogging = [
    '/_next/',
    '/static/',
    '/favicon.ico',
    '/api/auth/session',
    '/api/auth/csrf',
    '/api/auth/callback',
    '/signin',
    '/signup'
  ].some(prefix => pathname.startsWith(prefix));
  
  if (!shouldSkipLogging) {
    logger.debug(`[Middleware] Handling request: ${pathname}${search}`);
  }
  
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

    // Apply rate limiting for non-public routes
    if (!isPublicRoute(pathname)) {
      const rateLimitMiddleware = rateLimit({
        preset: isSensitiveEndpoint(pathname) ? 'sensitive' : 'publicApi',
        skip: (req) => req.method === 'OPTIONS' // Skip for preflight requests
      });
      
      const rateLimitResponse = await rateLimitMiddleware(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
    }

    // Skip session check for public routes
    if (isPublicRoute(pathname)) {
      return response;
    }

    // Create Supabase client with proper cookie handling
    // In src/middleware.ts, update the Supabase client configuration:
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      get(name: string) {
        const cookie = request.cookies.get(name)?.value;
        if (cookie && cookie.startsWith('base64-')) {
          try {
            return Buffer.from(cookie.slice(7), 'base64').toString('utf-8');
          } catch {
            return cookie;
          }
        }
        return cookie;
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
        });
      },
      remove(name: string, options: any) {
        response.cookies.set({
          name,
          value: '',
          ...options,
          maxAge: 0,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
        });
      },
    },
  }
);
    // Get both session and user for verification
    const [
      { data: { session }, error: sessionError },
      { data: { user }, error: userError }
    ] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser()
    ]);
    
    if (sessionError || userError) {
      const error = sessionError || userError;
      logger.error(`[Auth] Error getting session/user for path=${pathname}: ${error instanceof Error ? error.message : String(error)}`);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
    
    // Verify session user matches authenticated user
    const isAuthenticated = session?.user?.id && user?.id && session.user.id === user.id;

    // Check if user is authenticated for protected routes
    if (isProtectedRoute(pathname) || isAdminRoute(pathname)) {
      if (!isAuthenticated) {
        // For API routes, return 401 instead of redirecting
        if (pathname.startsWith('/api/')) {
          return new NextResponse(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // For pages, redirect to sign-in with the current path as the return URL
        // Check for redirect loops
        const redirectCount = parseInt(request.cookies.get('_redirect_count')?.value || '0', 10);
        
        if (redirectCount >= MAX_REDIRECTS) {
          logger.error('Redirect loop detected', { pathname, redirectCount });
          return new NextResponse('Too many redirects', { status: 308 });
        }
        
        const returnUrl = encodeURIComponent(pathname);
        const loginUrl = `/signin?returnUrl=${returnUrl}`;
        
        logger.debug(`[Auth] Redirecting to login: ${loginUrl}`, { redirectCount });
        
        const response = NextResponse.redirect(new URL(loginUrl, request.url));
        response.cookies.set('_redirect_count', (redirectCount + 1).toString(), {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 60, // 1 minute
          path: '/',
        });
        
        return response;
      }

        try {
        // Fetch user roles with error handling
        const roles = await fetchUserRoles(user.id, { accessToken: session.access_token });
        const highestRole = getHighestRole(roles);
        const dashboardPath = getDashboardPath(highestRole);

        logger.debug('User roles and dashboard path', { 
          userId: user.id, 
          roles, 
          highestRole, 
          dashboardPath 
        });

        // If user is on /signin, redirect to their dashboard
        if (pathname.startsWith('/signin')) {
          logger.info(`User already signed in, redirecting to dashboard: ${dashboardPath}`);
          return NextResponse.redirect(new URL(dashboardPath, request.url));
        }

        // Check if the current path is a dashboard path
        const roleFromPath = pathname.split('/')[1];
        const isDashboardPath = ROUTE_CONFIG.protected.startsWith.some(p => p.includes(roleFromPath));

        // If it's a dashboard path, verify access
        if (isDashboardPath && isValidRole(roleFromPath)) {
          const hasAccess = hasRole(roles, roleFromPath as UserRole);
          
          if (!hasAccess) {
            logger.warn(`User does not have permission for dashboard: ${roleFromPath}`, { 
              userId: user.id,
              userRoles: roles,
              requestedRole: roleFromPath
            });
            
            return NextResponse.redirect(new URL(dashboardPath, request.url));
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user roles';
        const errorObj = error instanceof Error ? error : new Error(errorMessage);
        logger.error('Error in role-based routing', { 
          userId: user.id, 
          error: errorObj
        });
        // Continue with the request if we can't verify roles
      }
    }

    // Handle admin routes
    if (isAdminRoute(pathname) && isAuthenticated) {
      try {
        // Always fetch fresh roles for admin checks
        const roles = await fetchUserRoles(session.user.id, { 
          accessToken: session.access_token 
        });
        
        if (!isAdmin(roles)) {
          logger.warn('Unauthorized admin access attempt', { 
            userId: session.user.id, 
            path: pathname,
            userRoles: roles
          });
          
          // Redirect to dashboard instead of showing 403
          const highestRole = getHighestRole(roles);
          const dashboardPath = getDashboardPath(highestRole);
          return NextResponse.redirect(new URL(dashboardPath, request.url));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorObj = error instanceof Error ? error : new Error(errorMessage);
        logger.error('Error checking admin access', { 
          userId: session.user.id, 
          error: errorObj
        });
        return new NextResponse('Internal Server Error', { status: 500 });
      }
    }

    // Clear redirect counter if we made it through without redirecting
    if (request.cookies.has('_redirect_count')) {
      response.cookies.delete('_redirect_count');
    }
    
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(`[Middleware] Error: ${errorMessage} at ${pathname}${stack ? `\n${stack}` : ''}`);
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

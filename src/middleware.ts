// This is the main middleware file that handles all HTTP requests
// It applies security headers, rate limiting, authentication, and CSRF protection

import { NextResponse, type NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { createMiddlewareClient } from '@/lib/supabase/middleware-client';
import { logCSRFEvent, logRateLimitEvent } from '@/lib/security/logger';
import { randomBytes } from 'crypto';

// CSRF Configuration
const CSRF_CONFIG = {
  COOKIE_NAME: 'sb-csrf-token',
  HEADER_NAME: 'X-CSRF-Token',
  MAX_AGE: 4 * 60 * 60, // 4 hours in seconds
  SECURE: process.env.NODE_ENV === 'production',
  SAME_SITE: 'strict' as const,
  PATH: '/',
  // Token replay prevention: Store used tokens for a short time
  TOKEN_REPLAY_WINDOW: 5 * 60 * 1000, // 5 minutes in milliseconds
  // Rate limiting for CSRF validation failures
  MAX_CSRF_ATTEMPTS: 5,
  CSRF_BAN_WINDOW: 15 * 60 * 1000, // 15 minutes in milliseconds
};

// Rate Limit Configuration
interface RateLimitConfig {
  [key: string]: {
    limit: number;
    window: number;
  };
}

const RATE_LIMIT_CONFIG: RateLimitConfig = {
  // Authentication endpoints
  '/api/auth/signin': { limit: 5, window: 60 }, // 5 requests per minute
  '/api/auth/signup': { limit: 10, window: 3600 }, // 10 requests per hour
  '/api/auth/forgot-password': { limit: 3, window: 3600 }, // 3 requests per hour
  
  // Default rate limits (requests per minute)
  DEFAULT: {
    limit: 100,
    window: 60, // 1 minute
  },
  
  // Sensitive endpoints with stricter limits
  SENSITIVE: {
    limit: 10,
    window: 60, // 1 minute
  },
  
  // Authentication endpoints
  AUTH: {
    limit: 5,
    window: 300, // 5 minutes
  },
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

// Route configurations
const ROUTE_CONFIG = {
  // Public routes with no auth/CSRF required
  public: {
    exact: ['/', '/api/health', '/api/auth/csrf'],
    startsWith: [
      '/_next',
      '/static',
      '/api/auth/callback',
      '/auth/verify-email',
      '/auth/reset-password',
      '/favicon.ico',
      '/api/auth/signin',
      '/api/auth/signup',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/verify-email'
    ]
  },
  // Protected routes that require authentication
  protected: {
    startsWith: [
      '/api/admin',
      '/api/volunteer',
      '/api/donor',
      '/api/member',
      '/dashboard',
      '/profile',
      '/settings',
      '/api/user',
      '/api/organization'
    ]
  },
  // Sensitive endpoints with stricter rate limiting
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

// Initialize Redis client for rate limiting
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// In-memory rate limiting (fallback for development)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Get rate limit configuration for a path
 */
function getRateLimitConfig(path: string) {
  // Check for exact path matches first
  const exactMatch = RATE_LIMIT_CONFIG[path];
  if (exactMatch) return exactMatch;
  
  // Check for path starts with matches
  for (const [key, config] of Object.entries(RATE_LIMIT_CONFIG)) {
    if (path.startsWith(key) && key !== 'DEFAULT' && key !== 'SENSITIVE' && key !== 'AUTH') {
      return config;
    }
  }
  
  // Default to sensitive rate limit for API routes
  if (path.startsWith('/api/')) {
    return RATE_LIMIT_CONFIG.SENSITIVE;
  }
  
  return RATE_LIMIT_CONFIG.DEFAULT;
}

/**
 * Rate limiting middleware with Redis support
 */
async function withRateLimit(
  key: string,
  path: string,
  request: NextRequest
): Promise<{
  isRateLimited: boolean;
  headers: Record<string, string>;
}> {
  // Get client IP and user agent for rate limiting
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const identifier = `${ip}:${Buffer.from(userAgent).toString('base64').slice(0, 16)}`;
  
  // Create a unique key for this client and endpoint
  const rateLimitKey = `rate_limit:${identifier}:${path}`;
  const { limit, window: windowSec } = getRateLimitConfig(path);
  const windowMs = windowSec * 1000;
  const now = Date.now();
  const resetAt = now + windowMs;
  
  let current: number;
  
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Use Redis in production
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      
      current = await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, windowSec);
      
      // Log rate limit event
      logRateLimitEvent(request, current > limit, {
        key: rateLimitKey,
        limit,
        remaining: Math.max(0, limit - current),
        resetAt,
        rateLimiter: 'redis',
      });
      
      if (current > limit) {
        return {
          isRateLimited: true,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(resetAt / 1000).toString(),
            'Retry-After': Math.ceil(windowMs / 1000).toString(),
          },
        };
      }
      
      return {
        isRateLimited: false,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': (limit - current).toString(),
          'X-RateLimit-Reset': Math.floor(resetAt / 1000).toString(),
        },
      };
    } catch (error) {
      // Log detailed error information
      console.error('Redis error in rate limiting:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        rateLimitKey,
        timestamp: new Date().toISOString()
      });
      
      // Log rate limit fallback event
      logRateLimitEvent(request, false, {
        key: rateLimitKey,
        limit,
        remaining: limit, // Assume full quota on error
        resetAt: now + windowMs,
        rateLimiter: 'memory',
        error: 'Redis error, falling back to in-memory rate limiting',
        errorDetails: error instanceof Error ? error.message : String(error)
      });
      
      // Fall through to in-memory rate limiting
      // Continue to in-memory rate limiting
    }
  }
  
  // Fallback to in-memory rate limiting
  const entry = rateLimits.get(rateLimitKey);
  
  if (entry) {
    if (now > entry.resetAt) {
      // Reset counter if window has passed
      rateLimits.set(rateLimitKey, { count: 1, resetAt });
      
      logRateLimitEvent(request, false, {
        key: rateLimitKey,
        limit,
        remaining: limit - 1,
        resetAt,
        rateLimiter: 'memory',
      });
      
      return {
        isRateLimited: false,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': (limit - 1).toString(),
          'X-RateLimit-Reset': Math.floor(resetAt / 1000).toString(),
        },
      };
    } else {
      // Increment counter
      const newCount = entry.count + 1;
      rateLimits.set(rateLimitKey, { count: newCount, resetAt: entry.resetAt });
      
      logRateLimitEvent(request, newCount > limit, {
        key: rateLimitKey,
        limit,
        remaining: Math.max(0, limit - newCount),
        resetAt: entry.resetAt,
        rateLimiter: 'memory',
      });
      
      if (newCount > limit) {
        return {
          isRateLimited: true,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(entry.resetAt / 1000).toString(),
            'Retry-After': Math.ceil((entry.resetAt - now) / 1000).toString(),
          },
        };
      }
      
      return {
        isRateLimited: false,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': (limit - newCount).toString(),
          'X-RateLimit-Reset': Math.floor(entry.resetAt / 1000).toString(),
        },
      };
    }
  } else {
    // First request in window
    rateLimits.set(rateLimitKey, { count: 1, resetAt });
    
    logRateLimitEvent(request, false, {
      key: rateLimitKey,
      limit,
      remaining: limit - 1,
      resetAt,
      rateLimiter: 'memory',
    });
    
    return {
      isRateLimited: false,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': (limit - 1).toString(),
        'X-RateLimit-Reset': Math.floor(resetAt / 1000).toString(),
      },
    };
  }
}

// List of sensitive paths that require token rotation
const SENSITIVE_PATHS = [
  '/api/auth/signin',
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/user/role',
  '/api/admin',
  '/api/export',
  '/api/import'
];

// In-memory store for used CSRF tokens (in production, consider using Redis)
const usedCsrfTokens = new Map<string, number>();

// In-memory store for CSRF validation failures (in production, consider using Redis)
const csrfValidationFailures = new Map<string, { count: number; until: number }>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean up used tokens older than the replay window
  for (const [token, timestamp] of usedCsrfTokens.entries()) {
    if (now - timestamp > CSRF_CONFIG.TOKEN_REPLAY_WINDOW) {
      usedCsrfTokens.delete(token);
    }
  }
  
  // Clean up expired CSRF validation failure records
  for (const [key, { until }] of csrfValidationFailures.entries()) {
    if (now > until) {
      csrfValidationFailures.delete(key);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// CSRF token validation with rotation for sensitive actions
export async function validateCSRFToken(
  token: string | null, 
  request: NextRequest, 
  response: NextResponse
): Promise<{ 
  isValid: boolean; 
  newToken?: string;
  error?: {
    status: number;
    message: string;
    code: string;
  }
}> {
  const { pathname, origin } = request.nextUrl;
  const isSensitiveAction = SENSITIVE_PATHS.some(path => pathname.startsWith(path));
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  // Skip CSRF check for safe methods and public routes
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || isPublicRoute(pathname)) {
    return { isValid: true };
  }

  // Check for rate limiting on CSRF validation failures
  const failureKey = `csrf_fail:${ip}`;
  const failureRecord = csrfValidationFailures.get(failureKey);
  const now = Date.now();
  
  if (failureRecord && now < failureRecord.until) {
    const error = {
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many CSRF validation failures. Please try again later.'
    };
    
    logCSRFEvent(request, false, {
      reason: 'rate_limited',
      path: pathname,
      method: request.method,
      error,
      attempts: failureRecord.count,
      retryAfter: Math.ceil((failureRecord.until - now) / 1000)
    });
    
    return { 
      isValid: false, 
      error
    };
  }

  // Check for token presence
  if (!token) {
    // Increment failure count
    const newCount = failureRecord ? failureRecord.count + 1 : 1;
    csrfValidationFailures.set(failureKey, {
      count: newCount,
      until: now + CSRF_CONFIG.CSRF_BAN_WINDOW
    });
    
    const error = {
      status: 403,
      code: 'MISSING_CSRF_TOKEN',
      message: 'CSRF token is required for this request'
    };
    
    logCSRFEvent(request, false, {
      reason: 'missing_token',
      path: pathname,
      method: request.method,
      error,
      attempts: newCount
    });
    
    return { 
      isValid: false, 
      error
    };
  }

  // Check for token replay
  if (usedCsrfTokens.has(token)) {
    const error = {
      status: 403,
      code: 'REUSED_CSRF_TOKEN',
      message: 'This CSRF token has already been used. Please refresh the page and try again.'
    };
    
    logCSRFEvent(request, false, {
      reason: 'token_replay',
      path: pathname,
      method: request.method,
      error
    });
    
    return { 
      isValid: false, 
      error
    };
  }

  // Get the session token from cookies
  const sessionToken = request.cookies.get(CSRF_CONFIG.COOKIE_NAME)?.value;
  
  // Verify the token matches the session token
  if (!sessionToken || token !== sessionToken) {
    // Increment failure count
    const newCount = failureRecord ? failureRecord.count + 1 : 1;
    csrfValidationFailures.set(failureKey, {
      count: newCount,
      until: now + CSRF_CONFIG.CSRF_BAN_WINDOW
    });
    
    const error = {
      status: 403,
      code: 'INVALID_CSRF_TOKEN',
      message: 'Invalid or expired CSRF token. Please refresh the page and try again.'
    };
    
    logCSRFEvent(request, false, {
      reason: 'token_mismatch',
      hasToken: !!token,
      hasSessionToken: !!sessionToken,
      tokensMatch: token === sessionToken,
      error,
      attempts: newCount
    });
    
    return { 
      isValid: false, 
      error
    };
  }
  
  // Mark token as used (only for non-GET requests)
  if (request.method !== 'GET') {
    usedCsrfTokens.set(token, Date.now());
  }
  
  // If it's a sensitive action, rotate the token
  if (isSensitiveAction) {
    return await rotateCSRFToken(request, response, pathname);
  }
  
  return { isValid: true };
}

// Rotate CSRF token and set it in both cookie and headers
async function rotateCSRFToken(
  request: NextRequest,
  response: NextResponse,
  pathname: string
): Promise<{ isValid: boolean; newToken: string }> {
  const newToken = generateCSRFToken();
  const oldToken = request.cookies.get(CSRF_CONFIG.COOKIE_NAME)?.value;
  
  // Set the new token in the response cookies
  setCSRFCookie(response, newToken);
  
  // Also set in response headers for API consumers
  response.headers.set(CSRF_CONFIG.HEADER_NAME, newToken);
  
  // Mark old token as used to prevent replay attacks during rotation
  if (oldToken) {
    usedCsrfTokens.set(oldToken, Date.now());
  }
  
  logCSRFEvent(request, true, {
    action: 'token_rotated',
    isSensitiveAction: true,
    path: pathname,
    tokenRotated: true
  });
  
  return { 
    isValid: true, 
    newToken 
  };
}

/**
 * Generate a new cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Set CSRF token in both cookie and response headers
 */
function setCSRFCookie(
  response: NextResponse,
  token: string,
  options: { maxAge?: number } = {}
): void {
  const { maxAge = 60 * 60 * 4 } = options;
  
  // Set HTTP-only cookie
  response.cookies.set({
    name: 'sb-csrf-token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge,
  });

  // Set header for client-side access
  response.headers.set('X-CSRF-Token', token);
}

// Generate or get CSRF token for the request
export async function getOrCreateCSRFToken(request: NextRequest, response: NextResponse): Promise<string> {
  // Check for existing token in cookies
  let token = request.cookies.get('sb-csrf-token')?.value;
  
  // Generate new token if it doesn't exist
  if (!token) {
    token = generateCSRFToken();
    setCSRFCookie(response, token);
  }
  
  return token;
}

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 1. Apply security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // 2. Handle CSRF protection for non-GET requests
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
    let csrfToken = request.headers.get(CSRF_CONFIG.HEADER_NAME);
    
    if (!csrfToken) {
      const formData = await request.clone().formData();
      const token = formData.get(CSRF_CONFIG.HEADER_NAME);
      csrfToken = typeof token === 'string' ? token : null;
    }
    
    const { isValid, error } = await validateCSRFToken(csrfToken, request, response);
    
    if (!isValid) {
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden',
          message: error?.message || 'Invalid CSRF token',
          code: 'INVALID_CSRF_TOKEN'
        }),
        { 
          status: error?.status || 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }

  // 3. Generate CSRF token for GET requests to pages
  if (request.method === 'GET' && !pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
    const token = await getOrCreateCSRFToken(request, response);
    response.headers.set(CSRF_CONFIG.HEADER_NAME, token);
  }

  // 4. Skip rate limiting for public routes
  if (isPublicRoute(pathname)) {
    return response;
  }

  // 5. Apply rate limiting
  try {
    const { isRateLimited, headers: rateLimitHeaders } = await withRateLimit(
      pathname,
      pathname,
      request
    );
    
    // Add rate limit headers to response
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    if (isRateLimited) {
      const retryAfter = rateLimitHeaders['Retry-After'] || '60';
      return new Response(
        JSON.stringify({ 
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter: parseInt(retryAfter, 10),
          code: 'RATE_LIMIT_EXCEEDED'
        }), 
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter,
            ...rateLimitHeaders,
            ...SECURITY_HEADERS
          }
        }
      );
    }
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Continue with the request if rate limiting fails
  }

  // Check authentication for protected routes
  if (isProtectedRoute(pathname)) {
    const { supabase } = createMiddlewareClient(request);
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
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token') || 
                     request.nextUrl.searchParams.get('_csrf');
    
    const { isValid, newToken, error } = await validateCSRFToken(csrfToken, request, response);
    
    if (!isValid) {
      // Log CSRF validation failure
      const errorDetails = {
        path: request.nextUrl.pathname,
        method: request.method,
        ip: request.ip,
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      };
      
      console.error('CSRF validation failed', {
        ...errorDetails,
        error: error?.code || 'unknown_error'
      });
      
      // Return appropriate error response
      return NextResponse.json(
        { 
          error: error?.code || 'CSRF_VALIDATION_FAILED',
          message: error?.message || 'Security verification failed',
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        },
        { 
          status: error?.status || 403,
          headers: { 
            'Content-Type': 'application/json',
            ...SECURITY_HEADERS
          } 
        }
      );
    }
    
    // If we have a new token from rotation, ensure it's in the response headers
    if (newToken) {
      response.headers.set('X-CSRF-Token', newToken);
      
      // For API responses, also include in the response body
      if (pathname.startsWith('/api/')) {
        try {
          const originalResponse = await response.clone().json().catch(() => ({}));
          return NextResponse.json(
            { ...originalResponse, csrfToken: newToken },
            { 
              headers: {
                ...Object.fromEntries(response.headers.entries()),
                'X-CSRF-Token': newToken
              },
              status: response.status
            }
          );
        } catch (error) {
          // If response is not JSON, just set the header
          response.headers.set('X-CSRF-Token', newToken);
        }
      }
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

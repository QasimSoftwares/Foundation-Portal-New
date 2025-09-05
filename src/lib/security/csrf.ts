import { randomBytes, timingSafeEqual } from 'crypto';
import { serialize } from 'cookie';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// CSRF token configuration
const CSRF_CONFIG = {
  // 32 bytes (256 bits) for the token
  TOKEN_BYTES: 32,
  // 1 day in seconds
  MAX_AGE: 24 * 60 * 60,
  // Cookie name for CSRF token
  COOKIE_NAME: 'sb-csrf-token',
  // Header names
  HEADER_NAME: 'x-csrf-token',
  NEW_TOKEN_HEADER: 'x-new-csrf-token',
  // Secure flag for production
  SECURE: process.env.NODE_ENV === 'production',
  // Token rotation settings (array of strings for TypeScript)
  ROTATE_ON: [
    'POST:/api/auth/signin',
    'POST:/api/auth/signup',
    'POST:/api/auth/change-password',
    'POST:/api/auth/reset-password',
    'POST:/api/auth/verify-email'
  ] as string[]
} as const;

type CSRFToken = {
  token: string;
  expires: Date;
  createdAt: Date;
};

/**
 * Generate a new CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(CSRF_CONFIG.TOKEN_BYTES).toString('hex');
}

/**
 * Set CSRF token in cookies
 */
export function setCSRFTokenCookie(response: NextResponse, token: string): void {
  const cookie = serialize(CSRF_CONFIG.COOKIE_NAME, token, {
    httpOnly: true,
    secure: CSRF_CONFIG.SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: CSRF_CONFIG.MAX_AGE,
  });
  
  response.headers.append('Set-Cookie', cookie);
}

/**
 * Get CSRF token from request
 */
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  try {
    // First check the header
    const headerToken = request.headers.get(CSRF_CONFIG.HEADER_NAME);
    if (headerToken) return headerToken;
    
    // Fallback to cookie (for traditional form submissions)
    const cookieToken = request.cookies.get(CSRF_CONFIG.COOKIE_NAME)?.value ?? null;
    return cookieToken;
  } catch (error) {
    logger.error('Error getting CSRF token from request', error as Error, {
      path: request.nextUrl.pathname,
      method: request.method
    });
    return null;
  }
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(
  requestToken: string | null,
  sessionToken: string | null
): boolean {
  if (!requestToken || !sessionToken) {
    return false;
  }

  try {
    // Use timing-safe comparison to prevent timing attacks
    const requestTokenBuffer = Buffer.from(requestToken, 'hex');
    const sessionTokenBuffer = Buffer.from(sessionToken, 'hex');
    
    return (
      requestTokenBuffer.length === CSRF_CONFIG.TOKEN_BYTES &&
      sessionTokenBuffer.length === CSRF_CONFIG.TOKEN_BYTES &&
      timingSafeEqual(requestTokenBuffer, sessionTokenBuffer)
    );
  } catch (e) {
    return false;
  }
}

/**
 * Get client IP from request
 */
function getClientIp(request: NextRequest): string | undefined {
  // Get IP from headers (prefer x-real-ip, fall back to x-forwarded-for)
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    undefined
  );
}

/**
 * Check if token should be rotated for the current request
 */
function shouldRotateToken(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const endpoint = `${method}:${pathname}`;
  return CSRF_CONFIG.ROTATE_ON.includes(endpoint);
}

/**
 * Middleware to handle CSRF protection with token rotation
 */
export function withCSRFProtection(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    // Skip CSRF check for safe methods and public routes
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return handler(request);
    }

    const response = NextResponse.next();
    const requestToken = getCSRFTokenFromRequest(request);
    const sessionToken = request.cookies.get(CSRF_CONFIG.COOKIE_NAME)?.value || null;

    try {
      // Validate CSRF token
      if (!validateCSRFToken(requestToken, sessionToken)) {
        logger.warn('CSRF validation failed', {
          path: request.nextUrl.pathname,
          method: request.method,
          ip: getClientIp(request),
          timestamp: new Date().toISOString(),
          hasToken: Boolean(requestToken),
          tokenValid: requestToken ? 'invalid' : 'missing'
        });

        return new NextResponse(
          JSON.stringify({ error: 'Invalid or missing CSRF token' }),
          { 
            status: 403, 
            headers: { 
              'Content-Type': 'application/json',
              'X-Request-Id': crypto.randomUUID(),
              'X-CSRF-Error': 'invalid_token'
            } 
          }
        );
      }

      // Handle token rotation for sensitive actions
      if (shouldRotateToken(request)) {
        const newToken = generateAndSetCSRFToken(response);
        response.headers.set(CSRF_CONFIG.NEW_TOKEN_HEADER, newToken);
      }

      // Process the request
      return handler(request).then((handlerResponse) => {
        // Merge headers from the handler response with our CSRF headers
        for (const [key, value] of response.headers.entries()) {
          if (value) handlerResponse.headers.set(key, value);
        }
        return handlerResponse;
      });
    } catch (error) {
      logger.error('Error in CSRF protection middleware', error as Error, {
        path: request.nextUrl.pathname,
        method: request.method,
        ip: getClientIp(request)
      });
      
      return new NextResponse(
        JSON.stringify({ error: 'Internal server error' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'X-Request-Id': crypto.randomUUID()
          } 
        }
      );
    }
  };
}

/**
 * Generate a new CSRF token and set it in the response
 */
export function generateAndSetCSRFToken(response: NextResponse): string {
  const token = generateCSRFToken();
  setCSRFTokenCookie(response, token);
  return token;
}

/**
 * Get the CSRF token for the current session
 */
export function getCSRFToken(request: NextRequest): string | undefined {
  return request.cookies.get(CSRF_CONFIG.COOKIE_NAME)?.value;
}

// Extend NextRequest type with CSRF token
declare module 'next/server' {
  interface NextRequest {
    csrfToken?: string;
  }
}

/**
 * Middleware to attach CSRF token to the request
 */
export function attachCSRFToken(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    // Attach the CSRF token to the request for easy access in route handlers
    request.csrfToken = getCSRFToken(request);
    return handler(request);
  };
}

// Route configurations for middleware
type PublicExactRoutes = '/' | '/api/health' | '/api/auth/csrf-token';
type PublicStartsWith = '/_next' | '/static' | '/api/auth/' | '/auth/' | '/signin' | '/signup' | '/forgot-password' | '/reset-password' | '/verify-email';
type ProtectedStartsWith = '/dashboard' | '/api/dashboard' | '/profile' | '/api/profile' | '/settings' | '/api/settings' | '/donor-request' | '/api/donor-request';
type SensitiveExactRoutes = '/api/auth/signin' | '/api/auth/signup' | '/api/auth/forgot-password' | '/api/auth/reset-password' | '/api/auth/verify-email' | '/api/auth/change-password';
type AdminStartsWith = '/admin' | '/api/admin';

export const ROUTE_CONFIG = {
  // Public routes that don't require authentication
  public: {
    exact: ['/', '/api/health', '/api/auth/csrf-token'] as const,
    startsWith: [
      '/_next',
      '/static',
      '/api/auth/',
      '/auth/',
      '/signin',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/verify-email'
    ] as const
  },
  
  // Protected routes that require authentication
  protected: {
    startsWith: [
      '/dashboard',
      '/api/dashboard',
      '/profile',
      '/api/profile',
      '/settings',
      '/api/settings',
      '/donor-request',
      '/api/donor-request'
    ]
  },
  
  // Sensitive endpoints that require additional protection
  sensitive: {
    exact: [
      '/api/auth/signin',
      '/api/auth/signup',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/verify-email',
      '/api/auth/change-password'
    ] as const
  },
  
  // Admin routes that require admin privileges
  admin: {
    startsWith: ['/admin', '/api/admin']
  }
} as const;

// Rate limit configuration type
type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

// Rate limiting configuration
export const RATE_LIMIT_CONFIG: {
  default: RateLimitConfig;
  sensitive: RateLimitConfig;
  publicApi: RateLimitConfig;
} = {
  // Default rate limit (requests per window)
  default: {
    limit: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Sensitive endpoints (login, password reset, etc.)
  sensitive: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Public API endpoints
  publicApi: {
    limit: 50,
    windowMs: 15 * 60 * 1000, // 15 minutes
  }
};

// Security headers configuration
export const SECURITY_HEADERS = {
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
} as const;

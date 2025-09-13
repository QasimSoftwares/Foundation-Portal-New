// Centralized route configuration

// Base route types
type PublicExactRoutes = '/' | '/api/health' | '/api/auth/csrf-token';
type PublicStartsWith = 
  | '/_next' 
  | '/static' 
  | '/api/auth/' 
  | '/auth/' 
  | '/signin' 
  | '/signup' 
  | '/forgot-password' 
  | '/reset-password' 
  | '/verify-email';

type ProtectedStartsWith = 
  | '/dashboard' 
  | '/api/dashboard' 
  | '/profile' 
  | '/api/profile' 
  | '/settings' 
  | '/api/settings' 
  | '/donor-request' 
  | '/api/donor-request';

type SensitiveExactRoutes = 
  | '/api/auth/signin' 
  | '/api/auth/signup' 
  | '/api/auth/forgot-password' 
  | '/api/auth/reset-password' 
  | '/api/auth/verify-email' 
  | '/api/auth/change-password';

type AdminStartsWith = 
  | '/admin' 
  | '/api/admin';

// Base route configuration
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
      '/donor/dashboard',
      '/volunteer/dashboard',
      '/member/dashboard',
      '/api/dashboard',
      '/profile',
      '/api/profile',
      '/settings',
      '/api/settings',
      '/donor-request',
      '/api/donor-request'
    ] as const
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
    startsWith: ['/admin', '/api/admin'] as const
  }
} as const;

// Admin route definitions
export const ADMIN_ROUTES = {
  // Dashboard
  dashboard: '/admin/dashboard',
  
  // Management sections
  donors: '/admin/donors',
  volunteers: '/admin/volunteers',
  members: '/admin/members',
  donations: '/admin/donations',
  
  // System
  reports: '/admin/reports',
  settings: '/admin/settings',
  
  // API endpoints
  api: {
    donors: '/api/admin/donors',
    volunteers: '/api/admin/volunteers',
    members: '/api/admin/members',
    donations: '/api/admin/donations',
    reports: '/api/admin/reports',
    settings: '/api/admin/settings',
    
    // Batch operations
    import: '/api/admin/import',
    export: '/api/admin/export',
    
    // System operations
    maintenance: '/api/admin/maintenance',
    cache: '/api/admin/cache',
  }
} as const;

// Role-based dashboard paths
export const ROLE_DASHBOARDS = {
  admin: '/admin/dashboard',
  member: '/member/dashboard',
  volunteer: '/volunteer/dashboard',
  viewer: '/dashboard',
  donor: '/donor/dashboard'
} as const;

type ValueOf<T> = T[keyof T];

export type AdminRoute = ValueOf<typeof ADMIN_ROUTES> | ValueOf<typeof ADMIN_ROUTES.api>;

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

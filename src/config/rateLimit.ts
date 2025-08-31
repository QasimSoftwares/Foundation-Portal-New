import { Redis } from '@upstash/redis';

export type RateLimitConfig = {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request) => void;
};

export type RateLimitPreset = 'public' | 'auth' | 'sensitive' | 'authVerification' | 'api';

/**
 * Default rate limit configurations for different types of endpoints
 */
export const RATE_LIMIT_CONFIG: Record<RateLimitPreset, RateLimitConfig> = {
  // Public API endpoints (higher limits)
  public: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Authentication endpoints (stricter limits)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Sensitive operations (very strict limits)
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour
    message: 'Too many sensitive operations, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Password reset and verification endpoints
  authVerification: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: 'Too many verification attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // General API endpoints
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'Too many API requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
};

/**
 * Rate limit related HTTP headers
 */
export const RATE_LIMIT_HEADERS = {
  limit: 'X-RateLimit-Limit',
  remaining: 'X-RateLimit-Remaining',
  reset: 'X-RateLimit-Reset',
  retryAfter: 'Retry-After',
};

/**
 * Default error messages
 */
export const RATE_LIMIT_MESSAGES = {
  tooManyRequests: 'Too many requests, please try again later.',
  rateLimitExceeded: 'Rate limit exceeded. Please try again later.',
};

/**
 * Redis client for distributed rate limiting
 */
export const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

/**
 * Get rate limit configuration for a specific route
 * @param preset The rate limit preset to use
 * @returns RateLimitConfig for the specified preset
 */
export function getRateLimitConfig(preset: RateLimitPreset = 'api'): RateLimitConfig {
  return RATE_LIMIT_CONFIG[preset];
}

/**
 * Check if rate limiting should be enabled based on environment
 */
export const isRateLimitEnabled = 
  process.env.NODE_ENV === 'production' || 
  process.env.ENABLE_RATE_LIMIT === 'true';

/**
 * Get the client's IP address from the request
 */
export const getClientIP = (req: Request): string => {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'unknown';
};

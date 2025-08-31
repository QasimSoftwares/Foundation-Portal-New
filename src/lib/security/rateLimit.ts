import { NextApiResponse } from 'next';
import { createApiResponse } from '../api-utils';

// In-memory store for rate limiting (replace with Redis in production for distributed systems)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  /**
   * Time window in milliseconds
   * @default 15 * 60 * 1000 (15 minutes)
   */
  windowMs?: number;
  /**
   * Maximum number of requests allowed in the time window
   * @default 100
   */
  max?: number;
  /**
   * Message to return when rate limit is exceeded
   * @default 'Too many requests, please try again later.'
   */
  message?: string;
  /**
   * Whether to include rate limit headers in the response
   * @default true
   */
  standardHeaders?: boolean;
  /**
   * Whether to enable the X-RateLimit-* headers
   * @default false
   */
  legacyHeaders?: boolean;
}

const defaultOptions: Required<RateLimitOptions> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

export function createRateLimiter(options: RateLimitOptions = {}) {
  const config = { ...defaultOptions, ...options };
  
  return (req: { [key: string]: any }, res: NextApiResponse) => {
    // Use IP address as the identifier (behind a proxy, you might need to check headers like 'x-forwarded-for')
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
    
    if (!ip) {
      console.warn('Could not determine IP address for rate limiting');
      return { success: true };
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean up old entries
    rateLimitStore.forEach((entry, key) => {
      if (entry.resetAt < windowStart) {
        rateLimitStore.delete(key);
      }
    });

    // Get or create rate limit entry
    let entry = rateLimitStore.get(ip);
    if (!entry) {
      entry = { count: 0, resetAt: now + config.windowMs };
      rateLimitStore.set(ip, entry);
    }

    // Check if rate limit is exceeded
    entry.count++;
    
    // Set rate limit headers if enabled
    if (config.standardHeaders) {
      res.setHeader('RateLimit-Limit', config.max.toString());
      res.setHeader('RateLimit-Remaining', Math.max(0, config.max - entry.count).toString());
      res.setHeader('RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());
    }
    
    if (config.legacyHeaders) {
      res.setHeader('X-RateLimit-Limit', config.max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - entry.count).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());
    }

    // Check if rate limit is exceeded
    if (entry.count > config.max) {
      if (config.standardHeaders) {
        res.setHeader('Retry-After', Math.ceil(config.windowMs / 1000).toString());
      }
      
      return { 
        success: false, 
        status: 429,
        message: config.message 
      };
    }

    return { success: true };
  };
}

// Rate limiter for CSRF token generation (stricter limits)
export const csrfRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: 'Too many CSRF token requests, please try again later.',
});

// Rate limiter for authentication endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
});

// Rate limiter for API endpoints
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many API requests, please try again later.',
});

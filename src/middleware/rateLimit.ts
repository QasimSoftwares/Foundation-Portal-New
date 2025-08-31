import { NextResponse, NextRequest } from 'next/server';
import { auditEvents } from '../services/auditService';
import { RATE_LIMIT_CONFIG, RateLimitPreset, getRateLimitConfig, isRateLimitEnabled, redis } from '../config/rateLimit';
import { getClientIP } from '../lib/security/ip';

// In-memory store for development when Redis is not available
const localStore = new Map<string, { count: number; resetTime: number; backoff: number }>();

interface RateLimitOptions {
  /**
   * The rate limit preset to use (default: 'api')
   */
  preset?: RateLimitPreset;
  
  /**
   * Custom key generator function (default: uses client IP)
   */
  keyGenerator?: (req: NextRequest) => string | Promise<string>;
  
  /**
   * Whether to skip rate limiting (default: false)
   */
  skip?: (req: NextRequest) => boolean | Promise<boolean>;
}

interface RateLimitData {
  count: number;
  resetTime: number;
  backoff: number;
}

/**
 * Rate limiting middleware with exponential backoff
 */
export const rateLimit = (options: RateLimitOptions = {}) => {
  const config = getRateLimitConfig(options.preset);
  const keyGenerator = options.keyGenerator || ((req) => getClientIP(req));

  return async (req: NextRequest) => {
    // Skip rate limiting if disabled or explicitly skipped
    if (!isRateLimitEnabled || (options.skip && await options.skip(req))) {
      return NextResponse.next();
    }

    const key = `rate-limit:${await keyGenerator(req)}`;
    const now = Date.now();
    let data: RateLimitData | null = null;

    try {
      // Try to get existing rate limit data
      if (redis) {
        // Use Redis in production
        const rawData = await redis.get(key);
        data = rawData ? JSON.parse(rawData as string) : null;
      } else {
        // Use in-memory store for development
        data = localStore.get(key) || null;
      }

      // Initialize or update rate limit data
      if (!data || now > data.resetTime) {
        data = {
          count: 0,
          resetTime: now + config.windowMs,
          backoff: 0,
        };
      }

      // Calculate backoff window and retry after
      const retryAfter = Math.ceil((data.resetTime - now) / 1000);

      // Check if rate limit is exceeded
      if (data.count >= config.max) {
        // Log security event
        await auditEvents.rateLimitExceeded(
          { 
            ip: req.ip || 'unknown',
            userId: 'unknown',
            email: 'unknown'
          },
          { 
            path: req.nextUrl.pathname,
            method: req.method,
            attempts: data.count,
            backoff: data.backoff,
            retryAfter,
          }
        );

        // Create error response
        return new NextResponse(
          JSON.stringify({ 
            error: config.message || 'Too many requests, please try again later.',
            retryAfter: `${retryAfter} seconds`,
          }),
          { 
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.max.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': data.resetTime.toString(),
            },
          }
        );
      }

      // Update rate limit data
      const updatedData: RateLimitData = {
        ...data,
        count: data.count + 1,
      };

      // Store the updated data
      if (redis) {
        const ttl = Math.ceil((updatedData.resetTime - now) / 1000);
        await redis.setex(key, ttl, JSON.stringify(updatedData));
      } else {
        localStore.set(key, updatedData);
      }

      // Create response with rate limit headers
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', config.max.toString());
      response.headers.set('X-RateLimit-Remaining', (config.max - updatedData.count).toString());
      response.headers.set('X-RateLimit-Reset', updatedData.resetTime.toString());

      return response;

    } catch (error) {
      console.error('Rate limit error:', error);
      // On error, allow the request to proceed but log the error
      return NextResponse.next();
    }
  };
};

/**
 * Increment backoff for a given key
 * @param key The rate limit key
 * @param windowMs The window in milliseconds
 * @returns The updated rate limit data
 */
async function incrementBackoff(key: string, windowMs: number): Promise<RateLimitData> {
  const now = Date.now();
  let data: RateLimitData;

  if (redis) {
    const rawData = await redis.get(key);
    data = rawData ? JSON.parse(rawData as string) : { count: 0, resetTime: now + windowMs, backoff: 0 };
  } else {
    data = localStore.get(key) || { count: 0, resetTime: now + windowMs, backoff: 0 };
  }

  // Increment backoff and update reset time
  const updatedData = {
    ...data,
    backoff: data.backoff + 1,
    resetTime: now + (windowMs * (2 ** data.backoff)),
  };

  // Store the updated data
  if (redis) {
    const ttl = Math.ceil((updatedData.resetTime - now) / 1000);
    await redis.setex(key, ttl, JSON.stringify(updatedData));
  } else {
    localStore.set(key, updatedData);
  }

  return updatedData;
}

/**
 * Reset rate limiting for a key
 * @param key The rate limit key to reset
 */
async function resetRateLimit(key: string): Promise<void> {
  try {
    if (redis) {
      await redis.del(key);
    } else {
      localStore.delete(key);
    }
  } catch (error) {
    console.error('Error resetting rate limit:', error);
  }
}

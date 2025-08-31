import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';
import { RATE_LIMIT_CONFIG, getRateLimitConfig } from '../config/rateLimit';

// In-memory store for development
const localStore = new Map<string, { count: number; resetTime: number; backoff: number }>();

// Redis client (will be initialized if REDIS_URL is provided)
let redisClient: any = null;

// Initialize Redis client if REDIS_URL is provided
const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
if (redisUrl) {
  redisClient = createClient({ url: redisUrl });
  redisClient.connect().catch(console.error);
}

interface RateLimitOptions {
  windowMs?: number;
  maxAttempts?: number;
  keyGenerator?: (req: NextRequest) => string;
}

/**
 * Rate limiting middleware for Next.js
 */
export const nextRateLimit = (options: RateLimitOptions = {}) => {
  const config = getRateLimitConfig('api');
  const windowMs = options.windowMs || config.windowMs;
  const maxAttempts = options.maxAttempts || config.max;
  const keyGenerator = options.keyGenerator || ((req) => req.ip || 'unknown');

  return async (request: NextRequest) => {
    const key = `rate-limit:${keyGenerator(request)}`;
    const now = Date.now();

    try {
      let data;
      
      if (redisClient) {
        // Check if we should use Redis or in-memory store
        try {
          const redisData = await redisClient.get(key);
          data = redisData ? JSON.parse(redisData) : null;
        } catch (error) {
          console.error('Redis error:', error);
          data = localStore.get(key);
        }
      } else {
        data = localStore.get(key);
      }

      // Initialize or update rate limit data
      if (!data || now > data.resetTime) {
        data = {
          count: 0,
          resetTime: now + windowMs,
          backoff: 0
        };
      }

      // Apply exponential backoff if needed
      if (data.backoff > now) {
        const retryAfter = Math.ceil((data.backoff - now) / 1000);
        return new NextResponse(
          JSON.stringify({ 
            error: 'Too many requests',
            message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
          }), 
          { 
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': maxAttempts.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': data.resetTime.toString(),
            }
          }
        );
      }

      // Check rate limit
      if (data.count >= maxAttempts) {
        // Apply exponential backoff with a max of 1 hour
        const backoffTime = Math.min(
          Math.pow(2, data.backoff) * 1000, // Exponential backoff
          60 * 60 * 1000 // Max backoff of 1 hour
        );
        
        data.backoff = now + backoffTime;
        
        if (redisClient) {
          await redisClient.set(key, JSON.stringify(data), { PX: windowMs });
        } else {
          localStore.set(key, data);
        }

        const retryAfter = Math.ceil(backoffTime / 1000);
        return new NextResponse(
          JSON.stringify({ 
            error: 'Too many requests',
            message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
          }), 
          { 
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': maxAttempts.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': data.resetTime.toString(),
            }
          }
        );
      }

      // Increment request count
      data.count++;

      // Save updated data
      if (redisClient) {
        await redisClient.set(key, JSON.stringify(data), { PX: windowMs });
      } else {
        localStore.set(key, data);
      }

      // Add rate limit headers to response
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', maxAttempts.toString());
      response.headers.set('X-RateLimit-Remaining', (maxAttempts - data.count).toString());
      response.headers.set('X-RateLimit-Reset', data.resetTime.toString());
      
      return response;
      
    } catch (error) {
      console.error('Rate limit error:', error);
      // On error, allow the request through but log it
      return NextResponse.next();
    }
  };
};

/**
 * Reset rate limiting for a key
 */
export const resetRateLimit = async (key: string) => {
  try {
    if (redisClient) {
      await redisClient.del(`rate-limit:${key}`);
    } else {
      localStore.delete(`rate-limit:${key}`);
    }
  } catch (error) {
    console.error('Error resetting rate limit:', error);
  }
};

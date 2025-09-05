import { NextRequest, NextResponse } from 'next/server';

type RateLimitConfig = {
  maxAttempts: number;
  windowMs: number;
  keyGenerator: (req: NextRequest) => string;
};

export function nextRateLimit(config: RateLimitConfig) {
  const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  return async (request: NextRequest) => {
    const key = config.keyGenerator(request);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean up old entries
    rateLimitStore.forEach((value, key) => {
      if (value.resetTime < windowStart) {
        rateLimitStore.delete(key);
      }
    });

    const entry = rateLimitStore.get(key) || { count: 0, resetTime: now + config.windowMs };
    
    if (now > entry.resetTime) {
      // Reset the counter if the window has passed
      entry.count = 1;
      entry.resetTime = now + config.windowMs;
    } else {
      entry.count += 1;
    }

    rateLimitStore.set(key, entry);

    const remaining = Math.max(0, config.maxAttempts - entry.count);
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', config.maxAttempts.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());

    if (entry.count > config.maxAttempts) {
      return NextResponse.json(
        { error: 'Too many requests, please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxAttempts.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString()
          }
        }
      );
    }

    return response;
  };
}

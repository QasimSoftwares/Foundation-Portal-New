import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize the rate limiter using Upstash Redis
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
  prefix: '@upstash/ratelimit',
});

type RateLimitOptions = {
  maxRequests?: number;
  timeWindow?: number;
  errorMessage?: string;
};

type Handler = (request: NextRequest) => Promise<NextResponse>;

export function withRateLimit(
  handler: Handler,
  options: RateLimitOptions = {}
): Handler {
  const {
    maxRequests = 10,
    timeWindow = 60 * 1000, // 1 minute
    errorMessage = 'Too many requests. Please try again later.',
  } = options;

  return async function (request: NextRequest) {
    // Get the IP address from the request
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Check rate limit
    const { success, limit, reset, remaining } = await ratelimit.limit(ip);

    // If rate limited, return error response
    if (!success) {
      const response = NextResponse.json(
        { error: errorMessage },
        { status: 429 }
      );
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', reset.toString());
      
      return response;
    }

    // Execute the handler and add rate limit headers to the response
    const response = await handler(request);
    
    // Add rate limit headers to the response
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());

    return response;
  };
}

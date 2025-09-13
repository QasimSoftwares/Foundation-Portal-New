import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';

// Deprecated module: use '@/lib/security/rateLimit' instead.
// Throw on import to prevent accidental usage.
throw new Error("Deprecated: Use '@/lib/security/rateLimit' (camelCase) as the single source of truth for rate limiting.");

type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
};

export default function rateLimit(options?: Options) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60 * 1000,
  });

  return {
    check: (req: NextRequest, limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = tokenCache.get(token) || [0];
        
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount);
        }
        
        tokenCount[0] += 1;
        
        const currentUsage = tokenCount[0];
        const isRateLimited = currentUsage > limit;
        
        const headers = new Headers();
        headers.set('X-RateLimit-Limit', limit.toString());
        headers.set('X-RateLimit-Remaining', isRateLimited ? '0' : (limit - currentUsage).toString());
        headers.set('X-RateLimit-Reset', (Date.now() + (options?.interval || 60 * 1000)).toString());

        if (isRateLimited) {
          const response = new NextResponse(
            JSON.stringify({
              error: 'Too many requests',
              message: 'Rate limit exceeded',
            }),
            {
              status: 429,
              headers,
            }
          );
          reject(response);
        } else {
          headers.forEach((value, key) => {
            req.headers.set(key, value);
          });
          resolve();
        }
      }),
  };
}

// Rate limit configurations
export const csrfRateLimit = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 users per minute
});

export const authRateLimit = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 100, // Max 100 users per hour
});

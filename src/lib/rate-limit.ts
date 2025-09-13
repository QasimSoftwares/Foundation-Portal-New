// DEPRECATED: Use '@/lib/security/rateLimit' instead.
import { NextRequest, NextResponse } from 'next/server';

// This module has been replaced by '@/lib/security/rateLimit'.
// Keeping a minimal stub to prevent imports from breaking while clearly failing fast.

type RateLimitOptions = {
  maxRequests?: number;
  timeWindow?: number;
  errorMessage?: string;
};

type Handler = (request: NextRequest) => Promise<NextResponse>;

export function withRateLimit(_handler: Handler, _options: RateLimitOptions = {}): Handler {
  return async function () {
    throw new Error("Deprecated: Use '@/lib/security/rateLimit' via Next.js middleware or call the exported rateLimit() from there.");
  } as Handler;
}

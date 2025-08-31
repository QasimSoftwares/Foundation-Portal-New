# Rate Limiting and Security Middleware

This document outlines the rate limiting and security middleware implementation for the application.

## Overview

The application uses a centralized security middleware that combines both CSRF protection and rate limiting. The implementation includes:

1. **Rate Limiting**: Protects against brute force and denial of service attacks
2. **CSRF Protection**: Prevents cross-site request forgery attacks
3. **Security Headers**: Adds essential security headers to all responses

## Configuration

Rate limiting is configured in `src/config/rateLimit.ts` with the following environment variables:

- `RATE_LIMIT_ENABLED`: Enable/disable rate limiting (default: `true` in production)
- `RATE_LIMIT_WINDOW_MS`: Base time window in milliseconds (default: 15 minutes)
- `RATE_LIMIT_BACKOFF_FACTOR`: Exponential backoff factor (default: 2)
- `REDIS_URL`: Redis connection string (optional, falls back to in-memory store)
- `TRUST_PROXY`: Enable if behind a proxy (default: `false`)

## Rate Limit Tiers

Different endpoints have different rate limits:

1. **Public API** (100 requests/minute)
   - All public API endpoints
   - Higher limits for general use

2. **Authentication** (10 requests/15 minutes)
   - `/api/auth/signin`
   - `/api/auth/signup`
   - Stricter limits to prevent brute force attacks

3. **Sensitive Operations** (5 requests/hour)
   - `/api/account/change-password`
   - `/api/account/update-email`
   - `/api/account/delete`
   - Very strict limits for sensitive operations

4. **Auth Verification** (3 requests/hour)
   - `/api/auth/forgot-password`
   - `/api/auth/reset-password`
   - `/api/auth/verify-email`
   - Prevents abuse of verification flows

## Response Headers

The following headers are included in rate-limited responses:

- `X-RateLimit-Limit`: Maximum number of requests allowed in the window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets (UNIX timestamp in seconds)
- `Retry-After`: Number of seconds to wait before making another request

## Error Responses

When rate limited, the API returns:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 60
}
```

## Implementation Details

### Rate Limit Store

- **Production**: Uses Redis for distributed rate limiting
- **Development**: Falls back to in-memory store (not suitable for production)

### Rate Limit Key Generation

Rate limits are tracked by a combination of:
- Client IP address
- User ID (if authenticated)
- Request path
- Rate limit type

### Exponential Backoff

Repeated violations of rate limits result in exponential backoff, with a maximum backoff period of 24 hours.

## Testing

To test rate limiting:

1. Make multiple requests to a protected endpoint
2. Check the response headers to monitor rate limit status
3. Verify that the rate limit is enforced correctly

## Monitoring

Monitor the following metrics:
- Rate limit hits
- Backoff activations
- Redis connection status (if using Redis)
- Error rates

## Troubleshooting

### Common Issues

1. **Rate limits too strict**: Adjust the rate limits in the configuration
2. **Redis connection issues**: Check the `REDIS_URL` and network connectivity
3. **Incorrect IP detection**: Ensure `TRUST_PROXY` is set correctly if behind a proxy

### Logs

Check the server logs for rate limiting events and errors.

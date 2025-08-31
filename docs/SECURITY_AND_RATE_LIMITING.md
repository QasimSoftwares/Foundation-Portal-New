# Security and Rate Limiting Implementation

This document provides a comprehensive guide to the application's security measures, with a focus on rate limiting, CSRF protection, and other security features.

## Table of Contents
- [Security Overview](#security-overview)
- [Rate Limiting](#rate-limiting)
  - [Features](#rate-limiting-features)
  - [Configuration](#rate-limiting-configuration)
  - [Usage](#rate-limiting-usage)
  - [Best Practices](#rate-limiting-best-practices)
- [CSRF Protection](#csrf-protection)
- [Security Headers](#security-headers)
- [Monitoring & Logging](#monitoring--logging)
- [Implementation Details](#implementation-details)
- [Troubleshooting](#troubleshooting)

## Security Overview

The application implements multiple layers of security:
- Rate limiting to prevent abuse and DDoS attacks
- CSRF protection for all state-changing operations
- Secure headers for modern browser protections
- Comprehensive audit logging
- Type-safe implementation with TypeScript

## Rate Limiting

### Rate Limiting Features

- Multiple rate limit presets (public, auth, sensitive, etc.)
- Redis-based distributed rate limiting for production
- In-memory rate limiting for development
- Exponential backoff for repeated violations
- Comprehensive audit logging
- TypeScript support with full type safety
- IP + User-Agent based rate limiting
- Granular endpoint-specific rate limits

### Rate Limiting Configuration

Rate limiting is configured in `src/config/rateLimit.ts` and includes:

- Preset configurations for different endpoint types
- Redis connection settings (via environment variables)
- Default rate limit values
- Error messages and headers

#### Environment Variables

```env
# Required for production
UPSTASH_REDIS_REST_URL=your_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_redis_rest_token

# Optional: Enable/disable rate limiting (default: enabled in production)
ENABLE_RATE_LIMIT=true
```

#### Default Rate Limits

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `/api/auth/signin` | 5 | 60s | Login attempts |
| `/api/auth/signup` | 10 | 3600s | New user registrations |
| `/api/auth/forgot-password` | 5 | 3600s | Password reset requests |
| `/api/auth/reset-password` | 5 | 3600s | Password resets |
| `/api/auth/verify-email` | 5 | 3600s | Email verification |
| `/api/admin/*` | 30 | 60s | Admin API endpoints |
| `/api/export` | 5 | 300s | Data export endpoints |
| `/api/import` | 2 | 60s | Data import endpoints |
| `/api/*` | 10 | 60s | Default API rate limit |
| Default | 10 | 60s | Catch-all rate limit |

### Rate Limiting Usage

#### Basic Usage

```typescript
import rateLimit from '@/middleware/rateLimit';

// Apply default rate limiting (api preset)
export const middleware = rateLimit();

export async function GET(request: Request) {
  // Your route handler
  return new Response('Hello, world!');
}
```

#### With Custom Preset

```typescript
import rateLimit, { RateLimitPreset } from '@/middleware/rateLimit';

// Apply auth rate limiting
export const middleware = rateLimit({
  preset: 'auth',
});
```

#### With Custom Key Generator

```typescript
const middleware = rateLimit({
  keyGenerator: (req) => {
    // Use user ID for authenticated users, fallback to IP
    const userId = getUserIdFromRequest(req);
    return userId || getClientIP(req);
  },
});
```

#### Skipping Rate Limiting

```typescript
const middleware = rateLimit({
  skip: (req) => {
    // Skip rate limiting for admin users
    return req.user?.isAdmin === true;
  },
});
```

### Rate Limit Headers

The middleware includes the following response headers:

- `X-RateLimit-Limit`: Maximum number of requests allowed in the window
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets
- `Retry-After`: Seconds until the rate limit resets (on 429 responses)

### Rate Limiting Best Practices

1. **Choose Appropriate Presets**: Use the most restrictive preset that makes sense for your endpoint
2. **Monitor Rate Limits**: Keep an eye on rate limit violations in your logs
3. **Set Sensible Defaults**: Adjust default values in the config to match your application's needs
4. **Use Exponential Backoff**: The built-in backoff helps prevent accidental DDoS during traffic spikes
5. **Test in Development**: Use the in-memory store for local development and testing

## CSRF Protection

### How It Works

1. **Token Generation**:
   - CSRF tokens are generated using `crypto.getRandomValues` for secure randomness
   - Tokens are stored in HTTP-only cookies named `sb-csrf-token`
   - Cookie attributes:
     - `httpOnly: true`
     - `secure: process.env.NODE_ENV === 'production'`
     - `sameSite: 'strict'`
     - `maxAge: 14400` (4 hours)
     - `path: '/'`

2. **Token Validation**:
   - Validated for all non-GET, non-HEAD, non-OPTIONS requests
   - Token can be provided in:
     - `X-CSRF-Token` header (preferred)
     - `_csrf` URL parameter (for GET requests when needed)
   - Token rotation occurs on successful validation for sensitive actions

3. **Sensitive Actions**:
   - Login
   - Signup
   - Password reset
   - Role changes
   - Any state-changing operations

## Security Headers

All responses include the following security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: Restricts access to sensitive browser features
- `Content-Security-Policy`: Strict policy with safe defaults

## Monitoring & Logging

### Security Events

All security-relevant events are logged with the following information:
- Event type (CSRF, rate limiting, auth, etc.)
- Severity level (info, warn, error)
- Timestamp
- Request details (path, method, IP, user agent)
- Additional context-specific metadata

### Log Storage
- **Development**: Logs are output to the console
- **Production**: Logs should be sent to a centralized logging service
  (e.g., Sentry, Datadog, ELK stack)

### Monitoring

Key metrics to monitor:
- Rate limit violations per endpoint
- CSRF validation failures
- Authentication failures
- Unusual traffic patterns

## Implementation Details

### Middleware
- `src/middleware.ts`: Centralized security middleware handling:
  - CSRF protection with token rotation on sensitive actions
  - Granular rate limiting with IP+User-Agent binding
  - Security headers with strict Content Security Policy
  - Authentication and authorization checks
  - Request validation and sanitization
  - Comprehensive error handling and logging
  - Redis-based rate limiting with in-memory fallback

### Rate Limiting Backend
- **Production**: Redis (via Upstash) with automatic failover
- **Development**: In-memory with automatic cleanup
- **Features**:
  - Sliding window algorithm
  - Automatic cleanup of expired entries
  - Detailed logging of rate limit events

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**:
   - Ensure Redis environment variables are set correctly
   - Check network connectivity to Redis server

2. **Rate Limits Not Enforced**:
   - Check that `ENABLE_RATE_LIMIT` is not set to `false`
   - Verify middleware is properly registered

3. **Incorrect IP Detection**:
   - If behind a proxy, ensure the correct IP is being extracted
   - Check `X-Forwarded-For` header configuration

4. **CSRF Token Validation Failures**:
   - Ensure tokens are being sent in the correct header
   - Verify cookie settings match between client and server

### Debugging

Set the following environment variable to enable debug logging:

```env
DEBUG=rate-limit,csrf
```

## Security Considerations

- Always use HTTPS in production
- Implement proper CORS policies
- Regularly rotate secrets and API keys
- Keep dependencies up to date
- Conduct regular security audits
- Implement proper error handling to avoid information leakage
- Monitor and log security events
- Follow the principle of least privilege
- Implement proper session management
- Use secure password policies
- Regularly back up data with proper encryption
- Implement proper input validation and output encoding
- Use security headers effectively
- Implement proper CORS policies
- Regularly test for vulnerabilities
- Keep security documentation up to date
- Train developers on secure coding practices
- Implement proper access controls
- Use secure defaults
- Implement proper error handling
- Monitor for suspicious activity
- Have an incident response plan in place

# Security Implementation

This document outlines the security measures implemented in the application, including CSRF protection, rate limiting, and monitoring.

## Table of Contents
- [CSRF Protection](#csrf-protection)
- [Rate Limiting](#rate-limiting)
- [Security Headers](#security-headers)
- [Monitoring & Logging](#monitoring--logging)
- [Implementation Details](#implementation-details)
- [Usage Guidelines](#usage-guidelines)
- [Testing & Verification](#testing--verification)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## CSRF Protection

### Overview

We've implemented a robust, centralized CSRF protection system that automatically handles token generation, validation, and rotation. The system is designed to be secure by default while remaining easy to use.

### How It Works

1. **Token Generation & Management**:
   - Tokens are generated using Node.js `crypto.randomBytes` for cryptographically secure randomness
   - Stored in HTTP-only, secure, same-site strict cookies named `sb-csrf-token`
   - Automatically managed by the centralized CSRF interceptor
   - Token rotation occurs after sensitive operations

2. **Centralized Protection**:
   - All API routes are automatically protected by default via middleware
   - Non-GET/HEAD/OPTIONS requests require a valid CSRF token
   - Token must be provided in the `X-CSRF-Token` header
   - The `fetchWithCSRF` wrapper automatically handles token management

3. **Implementation Details**:
   - **Middleware**: `withCSRFProtection` wraps API route handlers
   - **Frontend**: `fetchWithCSRF` wrapper handles token management
   - **Token Rotation**: Automatic after sensitive operations (login, password reset, etc.)
   - **Error Handling**: Detailed logging of CSRF validation failures

4. **Sensitive Endpoints (Token Rotation)**:
   - `/api/auth/signin`
   - `/api/auth/signup`
   - `/api/auth/change-password`
   - `/api/auth/reset-password`
   - `/api/auth/verify-email`

### Usage Guidelines

#### Frontend

Use the `fetchWithCSRF` wrapper for all API calls that modify state:

```typescript
import { fetchWithCSRF } from '@/lib/http/csrf-interceptor';

// In your component or utility
const response = await fetchWithCSRF('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

#### API Routes

All API routes are automatically protected by the middleware. No additional code is needed in individual route handlers.

## Rate Limiting

### Configuration

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

> **Note**: Rate limits are applied per IP address and user agent combination to prevent abuse while minimizing false positives.

### IP-based Rate Limiting with User-Agent Binding

Rate limiting is enforced based on a combination of:
- Client IP address
- User-Agent header (first 16 characters of base64-encoded)
- Request path

This provides better protection against distributed attacks while minimizing false positives.

### Response Headers
- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets
- `Retry-After`: Seconds to wait before retrying (when rate limited)

## Security Headers

All responses include the following security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: Restricts access to sensitive browser features
- `Content-Security-Policy`: Strict policy with safe defaults
- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets
- `Retry-After`: Seconds to wait before retrying (when rate limited)

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

### CSRF Protection
- **Token Generation**: 
  - Uses Web Crypto API for cryptographically secure tokens
  - 64-character hex string for high entropy
  - Stored in HTTP-only cookies with secure attributes

- **Token Rotation**:
  - Rotated on every sensitive action (login, signup, password reset, etc.)
  - Prevents token reuse and session fixation attacks
  - Implemented in `validateCSRFToken` function

- **Cookie Settings**:
  - `httpOnly: true` - Not accessible via JavaScript
  - `secure: true` in production - Only sent over HTTPS
  - `sameSite: 'strict'` - Prevents CSRF attacks
  - `path: '/'` - Available across the entire site
  - `maxAge: 14400` - 4 hour expiration

- **Validation**:
  - Required for all non-GET, non-HEAD, non-OPTIONS requests
  - Validates token presence and format
  - Compares token from header with cookie value using constant-time comparison

## Usage Guidelines

### For Frontend Developers
1. Include CSRF token in all form submissions and API calls:
   ```typescript
   // In your form or API client
   const csrfToken = document.cookie
     .split('; ')
     .find(row => row.startsWith('sb-csrf-token='))
     ?.split('=')[1];
   
   // Add to fetch headers
   const headers = {
     'Content-Type': 'application/json',
     'X-CSRF-Token': csrfToken
   };
   ```

2. Handle rate limit responses:
   ```typescript
   try {
     const response = await fetch('/api/endpoint', { method: 'POST' });
     if (response.status === 429) {
       const retryAfter = response.headers.get('Retry-After');
       console.log(`Rate limited. Try again in ${retryAfter} seconds`);
     }
   } catch (error) {
     console.error('Request failed:', error);
   }
   ```

### For Backend Developers
1. All API routes are automatically protected by CSRF and rate limiting
2. No additional configuration needed for standard endpoints

## Error Handling

### Rate Limiting Errors
- Returns HTTP 429 (Too Many Requests) when rate limited
- Includes `Retry-After` header with wait time
- Logs rate limit events with detailed context
- Provides clear error messages in development

### CSRF Protection Errors
- Returns HTTP 403 (Forbidden) for invalid/missing tokens
- Logs CSRF validation failures with request details
- Handles token rotation failures gracefully
- Provides clear error messages in development

### Best Practices

#### For Frontend Developers
1. **CSRF Tokens**
   - Include token in all state-changing requests
   - Store token in a secure HTTP-only cookie
   - Handle token expiration gracefully

2. **Rate Limiting**
   - Implement exponential backoff for rate-limited requests
   - Show user-friendly error messages
   - Cache successful responses when appropriate

3. **Error Handling**
   - Handle 403 and 429 status codes appropriately
   - Log client-side errors for debugging
   - Provide clear feedback to users

#### For Backend Developers
1. **Configuration**
   - Keep rate limits in sync with application requirements
   - Monitor rate limit violations
   - Adjust limits based on usage patterns

2. **Monitoring**
   - Set up alerts for security events
   - Monitor Redis health and performance
   - Regularly review security logs

## Testing & Verification

### CSRF Protection Tests
1. Verify token validation for all forms and API endpoints
2. Test token rotation only occurs for sensitive actions
3. Verify cookie security attributes
4. Test with missing/invalid tokens
5. Verify proper error responses

### Rate Limiting Tests
1. Verify rate limits for each endpoint type
2. Test IP+User-Agent binding
3. Verify Redis fallback behavior
4. Test rate limit headers in responses
5. Verify Retry-After header when rate limited

### Security Headers
1. Verify all responses include security headers
2. Test CSP violations in development
3. Verify referrer policy in different navigation scenarios
4. Test frame embedding restrictions
5. Verify content type sniffing protection

### Monitoring Tests
1. Verify security events are properly logged
2. Test error conditions and verify logging
3. Verify rate limit violation logging
4. Test CSRF failure logging
5. Verify production logging integration
      <CSRFTokenInput />
      {/* form fields */}
      <button type="submit">Submit</button>
    </form>
  );
}
```

#### In API Routes (App Router)

CSRF protection is automatically applied to all non-GET requests via the middleware.

#### In Custom Fetch Calls

```ts
import { submitWithCSRF } from '@/lib/security/form-utils';

async function submitData(data: FormData) {
  try {
    const result = await submitWithCSRF('/api/endpoint', data);
    // Handle success
  } catch (error) {
    // Handle error
  }
}
```

### Testing

Run the test suite to verify CSRF protection:

```bash
npm test src/__tests__/security/csrf.test.ts
```

### Security Considerations

- CSRF tokens are automatically managed by the middleware
- Tokens are rotated on each request for sensitive operations
- The HTTP-only cookie prevents XSS attacks from stealing the token
- SameSite cookie policy provides additional protection against CSRF

## Rate Limiting

Rate limiting is implemented to prevent brute force attacks. The current configuration allows:

- 10 requests per minute for authentication endpoints
- 100 requests per minute for API endpoints

## Session Management

- Sessions are managed by Supabase Auth
- Session tokens are stored in HTTP-only cookies
- Session expiration is configured according to Supabase settings

## Data Protection

- All sensitive data is encrypted in transit (HTTPS)
- Passwords are hashed using industry-standard algorithms
- Sensitive data is never logged

## Reporting Security Issues

Please report any security vulnerabilities to the project maintainers.

# Security Implementation

This document outlines the security measures implemented in the application, including session management, CSRF protection, rate limiting, and monitoring.

## Table of Contents
- [Session Management](#session-management)
- [CSRF Protection](#csrf-protection)
- [Rate Limiting](#rate-limiting)
- [Security Headers](#security-headers)
- [Monitoring & Logging](#monitoring--logging)
- [Implementation Details](#implementation-details)
- [Usage Guidelines](#usage-guidelines)
- [Testing & Verification](#testing--verification)
- [Error Handling](#error-handling)
- [Implementation Gaps](#implementation-gaps)
- [Future Work](#future-work)

## Session Management

### Overview

Our application implements a robust session management system with the following security features:

1. **Token-based Authentication**: Uses access and refresh tokens for session management
2. **RPC-based Session Management**: All session operations go through PostgreSQL RPC functions
3. **Session Revocation**: Supports explicit session revocation with audit logging
4. **Security Event Logging**: Comprehensive audit trail of security events

### Implementation Details

- **Session Storage**: Sessions are stored in the `sessions` table with the following schema:
  - `session_id`: UUID primary key
  - `user_id`: Reference to auth.users
  - `device_id`: Optional device identifier
  - `ua_hash`: Hashed user agent string
  - `ip`: Client IP address
  - `created_at`: Session creation timestamp
  - `last_seen_at`: Last activity timestamp
  - `revoked_at`: When the session was revoked (if applicable)
  - `revoked_reason`: Reason for revocation

- **Refresh Tokens**: Stored in the `refresh_tokens` table with:
  - `refresh_token_id`: UUID primary key
  - `user_id`: Reference to auth.users
  - `token`: Hashed refresh token
  - `created_at`: Token creation timestamp
  - `expires_at`: Token expiration timestamp
  - `revoked`: Boolean flag for token revocation
  - `ip_address`: Client IP address
  - `user_agent`: Client user agent
  - `session_id`: Reference to sessions table

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `accessTokenCookieName` | `sb-access-token` | Name of the access token cookie |
| `refreshTokenCookieName` | `sb-refresh-token` | Name of the refresh token cookie |
| `accessTokenMaxAge` | 1 hour | Access token lifetime in seconds |
| `refreshTokenMaxAge` | 7 days | Refresh token lifetime in seconds |
| `secureCookies` | `true` in production | Only send cookies over HTTPS |
| `sameSite` | `lax` | Cookie SameSite attribute |

## CSRF Protection

### Overview

Implements a robust CSRF protection system with the following features:

1. **Token Generation**: Uses cryptographically secure random bytes (32 bytes/256 bits)
2. **Token Storage**: HTTP-only, secure, SameSite=strict cookies
3. **Token Validation**: Constant-time comparison to prevent timing attacks
4. **Token Rotation**: Automatic rotation on sensitive operations

### Implementation Details

- **Token Generation**: Uses Web Crypto API for secure random token generation
- **Token Storage**: Stored in `sb-csrf-token` cookie with the following attributes:
  - `httpOnly: true`
  - `secure: true` (in production)
  - `sameSite: 'strict'`
  - `maxAge: 86400` (24 hours)
- **Token Validation**:
  - Required for all non-GET/HEAD/OPTIONS requests
  - Must be provided in the `X-CSRF-Token` header
  - Validated against the token stored in the session cookie

### Sensitive Endpoints (Token Rotation)

- `/api/auth/signin`
- `/api/auth/signup`
- `/api/auth/change-password`
- `/api/auth/reset-password`
- `/api/auth/verify-email`

## Rate Limiting

### Configuration

Implemented in `src/middleware.ts` with in-memory rate limiting (Redis recommended for production).

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `/api/auth/signin` | 5 | 60s | Login attempts |
| `/api/auth/signup` | 10 | 3600s | New user registrations |
| `/api/auth/forgot-password` | 5 | 3600s | Password reset requests |
| `/api/auth/reset-password` | 5 | 3600s | Password resets |
| `/api/auth/verify-email` | 5 | 3600s | Email verification |
| `/api/admin/*` | 30 | 60s | Admin API endpoints |
| Default | 10 | 60s | Default API rate limit |

### Rate Limit Key Generation

Rate limits are tracked by a combination of:
- Client IP address
- User-Agent header (first 16 chars of base64-encoded)
- Request path

### Response Headers
- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets (milliseconds)
- `Retry-After`: Seconds to wait before retrying (when rate limited)

## Security Headers

All responses include the following security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: Restricts access to sensitive browser features
- `Content-Security-Policy`: Default policy with safe defaults

## Monitoring & Logging

### Security Events

All security-relevant events are logged with the following information:
- Event type (CSRF, rate limiting, auth, etc.)
- Severity level (info, warn, error)
- Timestamp
- Request details (path, method, IP, user agent)
- Additional context (error details, user ID, etc.)

### Log Storage
- **Development**: Logs are output to the console
- **Production**: Should be configured to send logs to a centralized logging service
  (e.g., Sentry, Datadog, ELK stack)

## Implementation Details

### Middleware

Security middleware is implemented in `src/middleware.ts` and includes:
- CSRF protection
- Rate limiting
- Request validation
- Security headers
- Error handling

### Session Management

Session management is handled by `SessionManager` class with the following features:
- Token-based authentication
- Refresh token rotation
- Session revocation
- Device tracking
- Security event logging

### Database Access

All database access follows these security principles:
1. **RPC-First**: Prefer RPC functions over direct table access
2. **Row-Level Security (RLS)**: Enabled on all tables
3. **Least Privilege**: Service roles have minimal required permissions
4. **Input Validation**: All inputs are validated before processing

## Usage Guidelines

### Frontend

1. **API Requests**:
   - Use the `fetchWithCSRF` wrapper for all API calls
   - Handle 401/403 responses by redirecting to login
   - Implement proper error handling for rate limits

2. **Authentication**:
   - Store tokens in HTTP-only cookies
   - Implement proper logout functionality
   - Handle token refresh transparently

### Backend

1. **Route Protection**:
   - All API routes are protected by default
   - Use middleware for role-based access control
   - Implement proper error handling and logging

2. **Rate Limiting**:
   - Configure appropriate limits for each endpoint
   - Monitor rate limit hits and adjust as needed
   - Implement exponential backoff for clients

## Testing & Verification

### Unit Tests

- CSRF token generation and validation
- Rate limiting logic
- Session management
- Error handling

### Integration Tests

- Authentication flow
- Session management
- Rate limiting
- Error conditions

### Manual Testing

1. **CSRF Protection**:
   - Verify token is required for POST/PUT/DELETE requests
   - Test token rotation on sensitive operations
   - Verify invalid tokens are rejected

2. **Rate Limiting**:
   - Test hitting rate limits
   - Verify proper headers are returned
   - Test different rate limits for different endpoints

3. **Session Management**:
   - Test concurrent session limits
   - Verify session revocation
   - Test token refresh flow

## Error Handling

### Rate Limit Errors
- Status: 429 Too Many Requests
- Headers: `Retry-After`, `X-RateLimit-*`
- Response: JSON with error details and retry information

### CSRF Errors
- Status: 403 Forbidden
- Response: JSON with error details
- Logs: Detailed error information

### Authentication Errors
- Status: 401 Unauthorized / 403 Forbidden
- Response: JSON with error details
- Logs: Detailed error information

## Implementation Gaps

1. **Distributed Rate Limiting**:
   - Current implementation uses in-memory store
   - Not suitable for horizontal scaling
   - **Recommendation**: Implement Redis-based rate limiting

2. **Security Event Monitoring**:
   - Basic logging is implemented
   - No real-time alerting
   - **Recommendation**: Integrate with monitoring solution

3. **Device Fingerprinting**:
   - Basic implementation exists
   - Could be enhanced with more device attributes
   - **Recommendation**: Implement more robust device fingerprinting

4. **Session Management**:
   - Basic session management is implemented
   - No idle timeout enforcement
   - **Recommendation**: Implement session timeout policies

## Future Work

1. **Enhanced Security Headers**:
   - Implement Content Security Policy (CSP) reporting
   - Add Expect-CT header
   - Implement Feature Policy

2. **Advanced Rate Limiting**:
   - Implement adaptive rate limiting
   - Add IP reputation system
   - Implement global rate limits

3. **Security Monitoring**:
   - Implement real-time alerting
   - Add anomaly detection
   - Implement audit logging

4. **Authentication Enhancements**:
   - Implement multi-factor authentication
   - Add device verification
   - Implement passwordless login

5. **Compliance**:
   - GDPR compliance
   - CCPA compliance
   - SOC 2 compliance

## Best Practices

1. **Secure Development**:
   - Regular dependency updates
   - Security code reviews
   - Automated security testing

2. **Monitoring**:
   - Monitor security events
   - Set up alerts for suspicious activity
   - Regular security audits

3. **Incident Response**:
   - Documented incident response plan
   - Regular security training
   - Post-incident reviews

4. **Documentation**:
   - Keep security documentation up to date
   - Document security decisions
   - Maintain runbooks for common issues
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

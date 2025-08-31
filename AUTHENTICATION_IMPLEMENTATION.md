# Authentication Implementation

This document outlines the authentication system implementation including session management, CSRF protection, and rate limiting.

## Table of Contents
- [Authentication Flow](#authentication-flow)
- [Session Management](#session-management)
- [CSRF Protection](#csrf-protection)
- [Rate Limiting](#rate-limiting)
- [Security Headers](#security-headers)
- [Error Handling](#error-handling)
- [Audit Logging](#audit-logging)
- [Environment Variables](#environment-variables)

## Authentication Flow

### 1. User Registration
1. Client submits signup form with email and password
2. Server validates input and creates user in Supabase Auth
3. On success:
   - Creates user profile in `profiles` table
   - Assigns default 'viewer' role in `user_roles` table
   - Sends email verification link
   - Returns success response with CSRF token

### 2. Email Verification
1. User clicks verification link in email
2. Server verifies token and marks email as verified
3. User is redirected to login page

### 3. User Login
1. Client submits login form with email and password
2. Server verifies credentials with Supabase Auth
3. On success:
   - Creates new session
   - Sets secure HTTP-only cookies
   - Returns user data and CSRF token
   - Resets rate limiting counters

### 4. Session Refresh
1. Client uses refresh token to get new access token
2. Server verifies refresh token
3. Issues new access token if valid
4. Rotates refresh token for security

## Session Management

### Tokens
- **Access Token**: Short-lived (15 minutes), stored in HTTP-only cookie
- **Refresh Token**: Longer-lived (7 days), stored in HTTP-only cookie
- **CSRF Token**: Short-lived (30 minutes), stored in HTTP-only cookie

### Cookie Configuration
```typescript
// Access Token
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000 // 15 minutes
}

// Refresh Token
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}

// CSRF Token
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 60 * 1000 // 30 minutes
}
```

## CSRF Protection

### Implementation
- Uses double-submit cookie pattern
- CSRF token required for all state-changing requests
- Token verified on the server for each request
- Token rotation on each use

### Endpoints
- `GET /auth/csrf` - Get new CSRF token
- All POST/PUT/DELETE endpoints require valid CSRF token

## Rate Limiting

### Configuration
- **Production**: Redis-backed rate limiting
- **Development**: In-memory rate limiting
- Configurable via environment variables

### Rate Limits
| Endpoint | Window | Max Attempts | Key |
|----------|--------|--------------|-----|
| /auth/signin | 15m | 5 | IP + Email |
| /auth/signup | 1h | 3 | IP |
| /auth/refresh | 5m | 10 | IP |
| /auth/forgot-password | 1h | 3 | IP |
| /auth/verify-email | 30m | 3 | IP |

### Response Headers
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Timestamp when limit resets
- `Retry-After`: Seconds until next allowed request (when rate limited)

## Security Headers

### Default Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Error Handling

### Standard Error Format
```typescript
{
  error: string;          // User-friendly error message
  code?: string;         // Error code for programmatic handling
  retryAfter?: number;   // Seconds until next allowed request
  details?: any;         // Additional error details (development only)
}
```

### Common Error Codes
- `auth/invalid-credentials`
- `auth/rate-limited`
- `auth/invalid-csrf`
- `auth/session-expired`
- `auth/unauthorized`

## Audit Logging

### Logged Events
- Login attempts (success/failure)
- Logout events
- Token refreshes
- Rate limit events
- Role changes
- Unauthorized access attempts

### Log Format
```typescript
{
  event: string;          // Event type
  userId?: string;        // Supabase user ID if available
  ipAddress?: string;     // Client IP address
  userAgent?: string;     // Client user agent
  metadata: {            // Event-specific data
    [key: string]: any;
  };
  timestamp: string;      // ISO timestamp
}
```

## Environment Variables

### Required
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

### Optional
```env
# Rate Limiting
REDIS_URL=redis://localhost:6379
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_ATTEMPTS=5
RATE_LIMIT_BACKOFF_FACTOR=2

# Security
TRUST_PROXY=false
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

## Next Steps

1. **Implement CAPTCHA** - Add after N failed login attempts
2. **Add Monitoring** - Set up alerts for suspicious activity
3. **Enhance Testing** - Add unit and integration tests
4. **Implement Account Lockout** - Temporary lockout after too many failures
5. **Add IP Reputation System** - Block known malicious IPs

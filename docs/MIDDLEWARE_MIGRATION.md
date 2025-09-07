# Middleware Implementation Guide

This document outlines the current middleware implementation in `src/middleware.ts`, which consolidates security and request handling logic following Next.js best practices.

## Current Implementation

### 1. Core Middleware Features

#### Request Processing Pipeline
1. **Request Validation**
   - Parses and validates incoming requests
   - Extracts and validates required headers
   - Verifies request methods and content types

2. **Security Headers**
   - Applies security headers to all responses
   - Implements Content Security Policy (CSP)
   - Sets XSS protection and frame options
   - Configures referrer and permissions policies

3. **Error Handling**
   - Centralized error handling middleware
   - Structured error responses
   - Detailed error logging
   - Graceful degradation

### 2. Security Features

#### CSRF Protection
- **Token Validation**: All non-GET requests require valid CSRF token
- **Token Rotation**: Automatic rotation on sensitive operations
- **Cookie Settings**: HTTP-only, secure, SameSite=strict cookies
- **Header Requirements**: `X-CSRF-Token` header must match cookie value

#### Rate Limiting
- **In-Memory Store**: Tracks request counts per client
- **Key Generation**: Combines IP and User-Agent for client identification
- **Rate Limit Tiers**:
  - Authentication: 5 requests/60s
  - Admin: 30 requests/60s
  - Default: 10 requests/60s

#### Session Management
- **Token Validation**: Verifies session tokens on protected routes
- **Device Fingerprinting**: Basic device identification
- **Session Invalidation**: Handles expired/revoked sessions

### 3. Configuration

#### Environment Variables
```env
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Optional
NODE_ENV=development
RATE_LIMIT_ENABLED=true
TRUST_PROXY=false
```

#### Route Configuration
Routes are protected based on their path patterns:
- Public routes: No authentication required
- Protected routes: Require valid session
- Admin routes: Require admin privileges

## Testing Procedures

### Automated Tests
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run security tests
npm run test:security
```

### Manual Testing Checklist

#### Authentication
- [ ] Sign in with valid credentials
- [ ] Attempt sign in with invalid credentials
- [ ] Test session persistence
- [ ] Verify session invalidation on logout

#### CSRF Protection
- [ ] Submit form without CSRF token
- [ ] Submit form with invalid CSRF token
- [ ] Verify token rotation on sensitive actions
- [ ] Test API requests with missing/invalid tokens

#### Rate Limiting
- [ ] Test rate limit headers in responses
- [ ] Verify rate limit enforcement
- [ ] Test different rate limits for different endpoints
- [ ] Check Retry-After header on rate limit

## Deployment

### Prerequisites
- Node.js 16+
- npm 8+
- Supabase project configured
- Environment variables set

### Deployment Steps
1. **Build the Application**
   ```bash
   npm ci
   npm run build
   ```

2. **Run Tests**
   ```bash
   npm test
   npm run test:integration
   ```

3. **Start the Application**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

### Monitoring
- Check application logs for errors
- Monitor rate limit violations
- Review security events
- Track performance metrics

## Troubleshooting

### Common Issues

#### CSRF Token Mismatch
1. Verify cookies are being sent with requests
2. Check token rotation logic
3. Ensure same-site cookie policy is not blocking requests

#### Rate Limiting Issues
1. Check client IP detection (especially behind proxies)
2. Verify rate limit counters are incrementing
3. Confirm window size configuration

#### Session Problems
1. Check token expiration
2. Verify session validation logic
3. Ensure proper error handling for expired sessions

## Rollback Procedure

1. **Immediate Rollback**
   ```bash
   # Restart with previous version
   git checkout HEAD~1
   npm install
   npm run build
   ```

2. **Investigate Issues**
   - Review error logs
   - Check system metrics
   - Identify root cause

3. **Hotfix**
   - Create a branch for the fix
   - Test thoroughly
   - Deploy fix following normal process

## Future Improvements

1. **Distributed Rate Limiting**
   - Implement Redis-based rate limiting
   - Add support for cluster mode

2. **Enhanced Security**
   - Add request validation middleware
   - Implement request signing
   - Add request replay protection

3. **Monitoring**
   - Add distributed tracing
   - Implement real-time monitoring
   - Set up alerting for security events

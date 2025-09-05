# Middleware Migration Guide

This document outlines the migration of the middleware functionality from `src/lib/supabase/middleware.ts` to the root `src/middleware.ts` file, following Next.js best practices.

## Changes Made

### 1. Consolidated Middleware
- Mored middleware logic to the root `middleware.ts` file
- Removed duplicate code and improved type safety
- Added comprehensive error handling and logging

### 2. Security Features
- **CSRF Protection**: Implemented with token validation and rotation
- **Rate Limiting**: Added with different limits for different routes
- **Security Headers**: Added CSP, XSS protection, and other security headers
- **Session Management**: Improved session validation and handling

### 3. Configuration
- Centralized route configuration in `src/config/routes.ts`
- Environment-specific settings
- Type-safe configuration objects

### 4. Error Handling
- Centralized error handling
- Detailed logging of security events
- Graceful error responses

## Testing

### Manual Testing
1. **Authentication Flow**
   - Sign in/out
   - Session persistence
   - Unauthorized access attempts

2. **CSRF Protection**
   - Form submissions
   - API requests
   - Token rotation

3. **Rate Limiting**
   - Multiple requests to sensitive endpoints
   - Different limits for different routes
   - Rate limit headers

4. **Error Handling**
   - Invalid requests
   - Server errors
   - Validation errors

## Deployment

1. **Backup**
   - Back up the current middleware file
   - Document rollback procedure

2. **Deployment Steps**
   ```bash
   # Build the application
   npm run build
   
   # Run tests
   npm test
   
   # Deploy to production
   npm run deploy
   ```

3. **Monitoring**
   - Monitor error rates
   - Check for rate limit violations
   - Review security logs

## Rollback Plan

If issues arise:

1. Revert to the previous middleware version
2. Restart the application
3. Investigate and fix the issue
4. Re-deploy once resolved

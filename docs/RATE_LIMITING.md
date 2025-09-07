# Rate Limiting Implementation

This document outlines the rate limiting implementation in the application, which is part of the security middleware.

## Overview

The application implements rate limiting to protect against brute force attacks, denial of service, and API abuse. The current implementation uses an in-memory store with the following characteristics:

- **In-Memory Store**: Default implementation (suitable for single-instance deployments)
- **Key Generation**: Combines IP address and User-Agent for client identification
- **Response Headers**: Includes rate limit information in all responses
- **Error Handling**: Returns appropriate HTTP status codes and error messages
- **Fixed Window Algorithm**: Simple but effective for basic protection

## Configuration

Rate limiting is configured in `src/middleware.ts` with the following defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| Default Limit | 10 requests | Default limit for all endpoints |
| Window | 60 seconds | Time window for rate limiting |
| Auth Endpoints | 5 requests/60s | Stricter limits for authentication |
| Admin Endpoints | 30 requests/60s | Higher limits for admin operations |
| Max Window Size | 24 hours | Maximum backoff window |
| Trust Proxy | false | Enable if behind a reverse proxy |

## Rate Limit Tiers

### 1. Authentication Endpoints (5 requests/60s)
- `/api/auth/signin`
- `/api/auth/signup`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/auth/verify-email`

### 2. Admin Endpoints (30 requests/60s)
- `/api/admin/*`

### 3. Public API (10 requests/60s)
- All other API endpoints

## Implementation Details

### Rate Limit Key Generation

Rate limits are tracked by a combination of:
- Client IP address (from `x-real-ip` or `x-forwarded-for` headers if behind proxy)
- First 16 characters of base64-encoded User-Agent
- Request path

### Response Headers

All responses include the following headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window | `10` |
| `X-RateLimit-Remaining` | Remaining requests in the current window | `5` |
| `X-RateLimit-Reset` | Unix timestamp when the limit resets (milliseconds) | `1620000000000` |
| `Retry-After` | Seconds to wait before retrying (only on 429) | `30` |

### Error Responses

When rate limited, the API returns:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1620000000000
Retry-After: 60
Content-Type: application/json

{
  "error": "rate_limit_exceeded",
  "message": "Too many requests, please try again later.",
  "retryAfter": 60
}
```

## Implementation Gaps

### Current Limitations
1. **Single-Instance Only**: The in-memory store doesn't work in a distributed environment
2. **No Persistence**: Rate limit state is lost on server restart
3. **No IP Whitelisting**: No way to exclude trusted IPs from rate limiting
4. **Basic Algorithm**: Uses fixed window counter (could be improved with token bucket or sliding window)
5. **No Request Prioritization**: All requests are treated equally

### Recommended Improvements
1. **Redis Integration**: For distributed rate limiting
2. **Configuration Management**: Move configuration to environment variables
3. **IP Whitelisting**: Add support for trusted IPs
4. **Advanced Algorithms**: Implement token bucket or sliding window algorithms
5. **Request Prioritization**: Allow critical requests during high load

## Testing

### Unit Tests
```typescript
describe('Rate Limiting', () => {
  it('should generate consistent rate limit keys', () => {
    // Test key generation logic
  });
  
  it('should enforce rate limits', async () => {
    // Test rate limit enforcement
  });
});
```

### Integration Tests
1. Test rate limit headers in responses
2. Verify different rate limits for different endpoints
3. Test concurrent request handling
4. Verify error responses when rate limited

### Manual Testing
1. Make requests to a rate-limited endpoint
2. Verify headers in the response
3. Test hitting the rate limit
4. Verify the Retry-After header is set correctly

## Monitoring

### Key Metrics to Monitor
- Rate limit hits per endpoint
- Top clients hitting rate limits
- Error rates for 429 responses
- Response times for rate-limited endpoints

### Logging
Rate limit events are logged with the following details:
- Timestamp
- Client IP
- User-Agent (truncated)
- Request path
- Rate limit status
- Remaining requests
- Reset time

## Future Work

### 1. Distributed Rate Limiting
- [ ] Implement Redis-based rate limiting
- [ ] Add support for cluster mode
- [ ] Implement distributed locks for consistency

### 2. Advanced Features
- [ ] Implement token bucket algorithm
- [ ] Add support for burst limits
- [ ] Implement request prioritization
- [ ] Add support for JWT-based rate limiting

### 3. Configuration
- [ ] Dynamic rate limit adjustment
- [ ] Per-user rate limits
- [ ] API key-based rate limiting
- [ ] Rate limit templates for common patterns

### 4. Monitoring & Analytics
- [ ] Real-time dashboard
- [ ] Alerting for abuse detection
- [ ] Historical analytics
- [ ] Anomaly detection
- Redis connection status (if using Redis)
- Error rates

## Troubleshooting

### Common Issues

1. **Rate limits too strict**: Adjust the rate limits in the configuration
2. **Redis connection issues**: Check the `REDIS_URL` and network connectivity
3. **Incorrect IP detection**: Ensure `TRUST_PROXY` is set correctly if behind a proxy

### Logs

Check the server logs for rate limiting events and errors.

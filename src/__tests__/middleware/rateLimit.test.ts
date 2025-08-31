import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/middleware/rateLimit';
import { redis } from '@/config/rateLimit';

// Mock the Redis client
jest.mock('@/config/rateLimit', () => ({
  ...jest.requireActual('@/config/rateLimit'),
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
}));

interface RateLimitData {
  count: number;
  resetTime: number;
  backoff?: number;
  attempts?: number;
  retryAfter?: number;
}

// Assert that redis is not null
const redisMock = redis!;

describe('Rate Limit Middleware', () => {
  let mockRequest: NextRequest;
  const mockNext = jest.fn();
  const mockResponse = new NextResponse();
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Create a mock request
    mockRequest = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'test-agent',
      },
    }) as unknown as NextRequest;
    
    // Mock the response
    jest.spyOn(NextResponse, 'next').mockReturnValue(mockResponse);
  });
  
  it('should allow requests under the rate limit', async () => {
    // Mock Redis get to return rate limit data
    (redisMock.get as jest.Mock).mockResolvedValueOnce(null);
    
    const middleware = rateLimit();
    const response = await middleware(mockRequest);
    
    expect(response).toBe(mockResponse);
    expect(redisMock.setex).toHaveBeenCalled();
  });
  
  it('should block requests over the rate limit', async () => {
    // Mock Redis get to return rate limit data
    const rateLimitData: RateLimitData = { 
      count: 11, 
      resetTime: Date.now() + 60000, 
      backoff: 1,
      attempts: 1,
      retryAfter: 60
    };
    (redisMock.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(rateLimitData));
    
    const middleware = rateLimit();
    const response = await middleware(mockRequest);
    
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeTruthy();
  });
  
  it('should handle Redis errors gracefully', async () => {
    // Mock Redis get to throw an error
    (redisMock.get as jest.Mock).mockRejectedValueOnce(new Error('Redis error'));
    
    const middleware = rateLimit();
    const response = await middleware(mockRequest);
    
    // Should allow the request to proceed on error (fail open)
    expect(response).toBe(mockResponse);
  });
  
  it('should respect the skip option', async () => {
    const shouldSkip = jest.fn().mockReturnValue(true);
    const middleware = rateLimit({ skip: shouldSkip });
    
    const response = await middleware(mockRequest);
    
    expect(shouldSkip).toHaveBeenCalledWith(mockRequest);
    expect(response).toBe(mockResponse);
    // Should not call Redis when skipped
    expect(redisMock.get).not.toHaveBeenCalled();
  });
  
  it('should use custom key generator when provided', async () => {
    const customKey = 'custom-key';
    const keyGenerator = jest.fn().mockReturnValue(customKey);
    
    const middleware = rateLimit({ keyGenerator });
    await middleware(mockRequest);
    
    expect(keyGenerator).toHaveBeenCalledWith(mockRequest);
    expect(redisMock.get).toHaveBeenCalledWith(expect.stringContaining(customKey));
  });
});

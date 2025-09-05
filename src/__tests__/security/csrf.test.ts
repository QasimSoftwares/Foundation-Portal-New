import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, validateCSRFToken, withCSRFProtection, generateAndSetCSRFToken, getCSRFTokenFromRequest } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock cookies-next
const mockCookies: Record<string, string> = {};
jest.mock('cookies-next', () => ({
  getCookie: jest.fn((name: string) => mockCookies[name]),
  setCookie: jest.fn((name: string, value: string) => {
    mockCookies[name] = value;
  }),
}));

describe('CSRF Protection', () => {
  // Mock CSRF config
  const CSRF_CONFIG = {
    COOKIE_NAME: 'sb-csrf-token',
    HEADER_NAME: 'x-csrf-token',
    NEW_TOKEN_HEADER: 'x-new-csrf-token',
  };

  // Mock Next.js request/response
  const createMockRequest = ({
    method = 'POST',
    path = '/api/test',
    token = 'test-csrf-token',
    includeHeader = true,
    includeCookie = true,
  } = {}) => {
    const headers = new Headers();
    if (includeHeader && token) {
      headers.set(CSRF_CONFIG.HEADER_NAME, token);
    }
    
    // Set up cookies in the mock
    if (includeCookie && token) {
      mockCookies[CSRF_CONFIG.COOKIE_NAME] = token;
    } else {
      delete mockCookies[CSRF_CONFIG.COOKIE_NAME];
    }
    
    const request = new NextRequest(`http://localhost${path}`, {
      method,
      headers,
    });
    
    // Mock cookies getter
    Object.defineProperty(request, 'cookies', {
      get: jest.fn(() => ({
        get: (name: string) => mockCookies[name],
      })),
    });

    // Mock IP
    Object.defineProperty(request, 'ip', {
      value: '127.0.0.1',
    });

    // Mock nextUrl for path matching
    Object.defineProperty(request, 'nextUrl', {
      value: new URL(`http://localhost${path}`),
    });

    return request;
  };

  // Mock handler that returns a promise
  const mockHandler = async () => {
    return NextResponse.json({ success: true });
  };

  beforeEach(() => {
    // Clear mocks between tests
    jest.clearAllMocks();
    Object.keys(mockCookies).forEach(key => delete mockCookies[key]);
  });

  describe('Token Generation', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateCSRFToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('Token Validation', () => {
    it('should validate matching tokens', () => {
      const token = 'test-token';
      expect(validateCSRFToken(token, token)).toBe(true);
    });

    it('should reject mismatched tokens', () => {
      expect(validateCSRFToken('token1', 'token2')).toBe(false);
    });

    it('should reject empty tokens', () => {
      expect(validateCSRFToken('', '')).toBe(false);
      expect(validateCSRFToken(null, 'token')).toBe(false);
      expect(validateCSRFToken('token', null)).toBe(false);
      expect(validateCSRFToken(null, null)).toBe(false);
    });
  });

  describe('Middleware', () => {
    it('should allow GET requests without CSRF token', async () => {
      const request = createMockRequest({ method: 'GET', includeHeader: false });
      const response = await withCSRFProtection(mockHandler)(request);
      expect(response.status).toBe(200);
    });

    it('should allow HEAD requests without CSRF token', async () => {
      const request = createMockRequest({ method: 'HEAD', includeHeader: false });
      const response = await withCSRFProtection(mockHandler)(request);
      expect(response.status).toBe(200);
    });

    it('should allow OPTIONS requests without CSRF token', async () => {
      const request = createMockRequest({ method: 'OPTIONS', includeHeader: false });
      const response = await withCSRFProtection(mockHandler)(request);
      expect(response.status).toBe(200);
    });

    it('should block POST requests without CSRF token', async () => {
      const request = createMockRequest({ method: 'POST', includeHeader: false, includeCookie: false });
      const response = await withCSRFProtection(mockHandler)(request);
      expect(response.status).toBe(403);
      expect(logger.warn).toHaveBeenCalledWith(
        'CSRF validation failed',
        expect.objectContaining({
          path: '/api/test',
          method: 'POST',
          hasToken: false,
          tokenValid: 'missing',
        })
      );
    });

    it('should allow POST requests with valid CSRF token', async () => {
      const token = 'test-csrf-token';
      const request = createMockRequest({ method: 'POST', token, includeHeader: true, includeCookie: true });
      const response = await withCSRFProtection(mockHandler)(request);
      expect(response.status).toBe(200);
    });

    it('should block POST requests with invalid CSRF token', async () => {
      const request = createMockRequest({ 
        method: 'POST', 
        token: 'valid-token',
        includeHeader: true,
        includeCookie: true
      });
      
      // Override the header with an invalid token
      request.headers.set(CSRF_CONFIG.HEADER_NAME, 'invalid-token');
      
      const response = await withCSRFProtection(mockHandler)(request);
      expect(response.status).toBe(403);
      expect(logger.warn).toHaveBeenCalledWith(
        'CSRF validation failed',
        expect.objectContaining({
          path: '/api/test',
          method: 'POST',
          hasToken: true,
          tokenValid: false,
        })
      );
    });

    it('should rotate token for sensitive endpoints', async () => {
      const token = 'test-csrf-token';
      const request = createMockRequest({ 
        method: 'POST', 
        path: '/api/auth/signin',
        token,
        includeHeader: true,
        includeCookie: true
      });
      
      const response = await withCSRFProtection(mockHandler)(request);
      expect(response.status).toBe(200);
      
      // Check if new token header is set
      expect(response.headers.get(CSRF_CONFIG.NEW_TOKEN_HEADER)).toBeDefined();
      expect(response.headers.get(CSRF_CONFIG.NEW_TOKEN_HEADER)).not.toBe(token);
    });

    it('should get CSRF token from request', () => {
      const token = 'test-token';
      const request = createMockRequest({ token, includeHeader: true, includeCookie: true });
      const requestToken = getCSRFTokenFromRequest(request);
      expect(requestToken).toBe(token);
    });

    it('should generate and set CSRF token in response', () => {
      const response = new NextResponse();
      const token = generateAndSetCSRFToken(response);
      
      expect(token).toBeDefined();
      expect(token).toHaveLength(64);
      expect(response.headers.get('set-cookie')).toContain(CSRF_CONFIG.COOKIE_NAME);
    });
  });
});

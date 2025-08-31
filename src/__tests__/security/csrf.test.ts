import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, validateCSRFToken } from '@/middleware';

// Simple test runner
const test = (name: string, fn: () => void | Promise<void>) => {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => {
        console.log(`✓ ${name}`);
      }).catch((error) => {
        console.error(`✗ ${name}`);
        console.error(error);
      });
    }
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
  }
};

const expect = (value: any) => ({
  toBe: (expected: any) => {
    if (value !== expected) {
      throw new Error(`Expected ${value} to be ${expected}`);
    }
  },
  toBeDefined: () => {
    if (value === undefined || value === null) {
      throw new Error('Expected value to be defined');
    }
  },
  toBeUndefined: () => {
    if (value !== undefined) {
      throw new Error(`Expected value to be undefined, got ${value}`);
    }
  },
  toMatch: (pattern: RegExp) => {
    if (!pattern.test(value)) {
      throw new Error(`Expected ${value} to match ${pattern}`);
    }
  },
  toHaveLength: (length: number) => {
    if (value.length !== length) {
      throw new Error(`Expected length ${length}, got ${value.length}`);
    }
  }
});

console.log('Running CSRF Protection Tests');

// Group tests
const runTests = () => {
  console.log('\nTesting generateCSRFToken');
  test('should generate a 64-character hex string', () => {
    const token = generateCSRFToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  console.log('\nTesting validateCSRFToken');
  const mockRequest = (token: string | null, path: string = '/api/test', method: string = 'POST') => {
    const headers = new Headers();
    if (token) {
      headers.set('x-csrf-token', token);
    }
    return new NextRequest(`http://localhost${path}`, {
      method,
      headers,
    });
  };

  test('should validate token for sensitive actions', async () => {
    const token = 'testtoken123';
    const request = mockRequest(token, '/api/auth/signin');
    const response = NextResponse.next();
    
    // Mock the cookie
    request.cookies.set({
      name: 'sb-csrf-token',
      value: token,
    });
    
    const result = await validateCSRFToken(token, request, response);
    expect(result.isValid).toBe(true);
    expect(result.newToken).toBeDefined(); // Token should be rotated for sensitive actions
  });

  test('should not rotate token for non-sensitive actions', async () => {
    const token = 'testtoken123';
    const request = mockRequest(token, '/api/non-sensitive');
    const response = NextResponse.next();
    
    // Mock the cookie
    request.cookies.set({
      name: 'sb-csrf-token',
      value: token,
    });
    
    const result = await validateCSRFToken(token, request, response);
    expect(result.isValid).toBe(true);
    expect(result.newToken).toBeUndefined(); // Token should not be rotated
  });

  test('should reject invalid tokens', async () => {
    const request = mockRequest('invalid-token');
    const response = NextResponse.next();
    request.cookies.set({
      name: 'sb-csrf-token',
      value: 'valid-token',
    });
    
    const result = await validateCSRFToken('invalid-token', request, response);
    expect(result.isValid).toBe(false);
  });

  test('should reject missing tokens', async () => {
    const request = mockRequest(null);
    const response = NextResponse.next();
    
    const result = await validateCSRFToken(null, request, response);
    expect(result.isValid).toBe(false);
  });
};

// Run all tests
runTests();

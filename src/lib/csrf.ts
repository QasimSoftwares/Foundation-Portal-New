import type { NextRequest, NextResponse } from 'next/server';
import { getCookie, setCookie } from './cookies';

// CSRF token constants
export const CSRF_HEADER = 'X-CSRF-Token';
export const CSRF_COOKIE = 'sb-csrf-token';

// Type for the response from fetchWithCSRF
export interface FetchWithCSRFResponse<T = any> extends Response {
  json(): Promise<T>;
}

/**
 * Get CSRF token from cookies
 */
export function getCSRFToken(): string | undefined {
  return getCookie(CSRF_COOKIE);
}

/**
 * Set CSRF token in cookies
 */
export function setCSRFToken(token: string, options: { days?: number } = {}): void {
  setCookie(CSRF_COOKIE, token, {
    days: options.days || 1,
    path: '/',
    sameSite: 'strict',
    secure: typeof window !== 'undefined' ? window.location.protocol === 'https:' : false,
  });
}

/**
 * Check if a response contains a new CSRF token
 */
export function hasNewCSRFToken(response: Response): boolean {
  return response.headers.has(CSRF_HEADER);
}

/**
 * Update CSRF token from response
 */
export function updateCSRFTokenFromResponse(response: Response): void {
  const newToken = response.headers.get(CSRF_HEADER);
  if (newToken) {
    setCSRFToken(newToken);
  }
}

/**
 * Create headers with CSRF token
 */
export function withCSRFToken(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFToken();
  if (!token) return headers;

  const headersObj = new Headers(headers);
  headersObj.set(CSRF_HEADER, token);
  return headersObj;
}

/**
 * Wrapper for fetch that automatically handles CSRF tokens
 */
export async function fetchWithCSRF<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<FetchWithCSRFResponse<T>> {
  const response = (await fetch(input, {
    ...init,
    headers: init?.headers ? withCSRFToken(init.headers) : withCSRFToken(),
  })) as FetchWithCSRFResponse<T>;

  // Update token if a new one was provided
  if (hasNewCSRFToken(response)) {
    updateCSRFTokenFromResponse(response);
  }

  return response;
}

// Extend the global Window interface with fetch
type CustomWindow = typeof globalThis & {
  fetch: typeof fetch;
};

declare const window: CustomWindow;

// Add CSRF token to all fetch requests if it exists
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  
  window.fetch = async function(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Add CSRF token to the request
    const requestInit: RequestInit = {
      ...init,
      headers: init?.headers ? withCSRFToken(init.headers) : withCSRFToken(),
    };
    
    const response = await originalFetch(input, requestInit);
    
    // Check for new CSRF token in the response
    if (hasNewCSRFToken(response)) {
      updateCSRFTokenFromResponse(response);
    }
    
    return response;
  };
}

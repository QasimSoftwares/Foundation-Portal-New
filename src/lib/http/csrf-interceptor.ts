'use client';

import { useEffect } from 'react';
import { getCookie } from 'cookies-next';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, CSRF_NEW_TOKEN_HEADER } from '@/lib/security/csrf';

// Helper to safely get CSRF token
const getCSRFToken = async (): Promise<string | null> => {
  try {
    const token = await getCookie(CSRF_COOKIE_NAME);
    return token?.toString() || null;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    return null;
  }
};

/**
 * Global fetch interceptor to automatically add CSRF token to requests
 * and handle token rotation from responses
 */
export function useCSRFInterceptor() {
  useEffect(() => {
    // Store original fetch
    const originalFetch = window.fetch;

    // Override fetch
    window.fetch = async (input, init) => {
      // Skip for GET/HEAD/OPTIONS requests
      const method = init?.method?.toUpperCase() || 'GET';
      const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes(method);
      
      // Create headers if they don't exist
      const headers = new Headers(init?.headers);
      
      // Add CSRF token for non-read operations
      if (!isReadOnly && !headers.has(CSRF_HEADER_NAME)) {
        const csrfToken = await getCSRFToken();
        if (csrfToken) {
          headers.set(CSRF_HEADER_NAME, csrfToken);
        }
      }

      // Make the request
      const response = await originalFetch(input, {
        ...init,
        headers,
        credentials: 'include', // Important for cookies
      });

      // Handle token rotation
      const newCSRFToken = response.headers.get(CSRF_NEW_TOKEN_HEADER);
      if (newCSRFToken) {
        // The new token will be automatically set by the browser via Set-Cookie
        // We don't need to do anything here as the cookie is httpOnly
      }

      return response;
    };

    // Cleanup
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
}

/**
 * Wrapper for fetch that includes CSRF token
 * Use this for manual fetch calls when needed
 */
export async function fetchWithCSRF(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method?.toUpperCase() || 'GET';
  const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  
  // Create headers if they don't exist
  const headers = new Headers(init?.headers);
  
  // Add CSRF token for non-read operations
  if (!isReadOnly && !headers.has(CSRF_HEADER_NAME)) {
    const csrfToken = await getCSRFToken();
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }
  }

  // Make the request
  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  return response;
}

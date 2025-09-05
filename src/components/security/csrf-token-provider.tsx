'use client';

import { useEffect, useState } from 'react';
import { getCookie } from 'cookies-next';

/**
 * CSRF Token Provider
 * 
 * This component automatically includes the CSRF token in forms.
 * The token is managed by the centralized middleware and is automatically
 * included in cookies. This component makes it available for forms.
 * 
 * For API requests, the token should be included in the 'X-CSRF-Token' header.
 * The fetch wrapper in your API client should handle this automatically.
 */
export function CSRFTokenInput() {
  const [csrfToken, setCsrfToken] = useState('');

  useEffect(() => {
    // Get CSRF token from cookie set by the middleware
    const token = getCookie('sb-csrf-token') as string;
    if (token) {
      setCsrfToken(token);
    }
  }, []);

  // For forms that don't use fetch/axios, include this hidden input
  return csrfToken ? (
    <input 
      type="hidden" 
      name="_csrf" 
      value={csrfToken} 
      data-testid="csrf-token"
    />
  ) : null;
}

/**
 * Hook to get the current CSRF token
 * Useful for manual fetch requests
 */
export function useCSRFToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const token = getCookie('sb-csrf-token') as string | undefined;
    setToken(token || null);
  }, []);

  return token;
}

/**
 * Fetch wrapper that automatically includes CSRF token in headers
 * Use this instead of the native fetch for API requests
 */
export async function fetchWithCSRF(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getCookie('sb-csrf-token') as string | undefined;
  
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('X-CSRF-Token', token);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include', // Important for sending cookies
  });
}

import { useCallback } from 'react';
import { apiClient } from './client';
import { useCSRFContext } from '@/providers/CSRFProvider';

type Headers = Record<string, string>;

interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Hook for making authenticated API requests with CSRF protection
 */
export function useApiClient() {
  const { csrfToken, refreshToken } = useCSRFContext();

  /**
   * Make an authenticated API request with CSRF protection
   */
  const authRequest = useCallback(
    async <T = any>(
      url: string,
      options: RequestInit = {}
    ): Promise<ApiResponse<T>> => {
      try {
        // Add CSRF token to headers for non-GET requests
        const headers: Headers = {
          ...(options.headers as Record<string, string> || {}),
        };

        if (options.method && options.method.toUpperCase() !== 'GET' && csrfToken) {
          headers['x-csrf-token'] = csrfToken;
        }

        const response = await apiClient<T>(url, {
          ...options,
          headers,
          credentials: 'include', // Important for cookies
        });

        return { data: response };
      } catch (error: any) {
        // Handle 401 Unauthorized (token expired)
        if (error?.status === 401) {
          try {
            // Try to refresh the CSRF token
            await refreshToken();
            
            // Get the new token after refresh
            const newToken = document.cookie
              .split('; ')
              .find(row => row.startsWith('sb-csrf-token='))
              ?.split('=')[1];

            if (newToken) {
              // Retry the request with the new token
              const retryHeaders: Headers = {
                ...(options.headers as Record<string, string> || {}),
                'x-csrf-token': newToken,
              };

              const retryResponse = await apiClient<T>(url, {
                ...options,
                headers: retryHeaders,
                credentials: 'include',
              });

              return { data: retryResponse };
            }
          } catch (refreshError) {
            console.error('Failed to refresh CSRF token:', refreshError);
            throw new Error('Session expired. Please refresh the page and try again.');
          }
        }

        // Re-throw other errors
        throw error;
      }
    },
    [csrfToken, refreshToken]
  );

  return {
    get: <T = any>(url: string, options?: RequestInit) =>
      authRequest<T>(url, { ...options, method: 'GET' }),
    
    post: <T = any>(url: string, body?: any, options?: RequestInit) =>
      authRequest<T>(url, { 
        ...options, 
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      }),
    
    put: <T = any>(url: string, body?: any, options?: RequestInit) =>
      authRequest<T>(url, { 
        ...options, 
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      }),
    
    delete: <T = any>(url: string, options?: RequestInit) =>
      authRequest<T>(url, { ...options, method: 'DELETE' }),
    
    patch: <T = any>(url: string, body?: any, options?: RequestInit) =>
      authRequest<T>(url, { 
        ...options, 
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      }),
  };
}

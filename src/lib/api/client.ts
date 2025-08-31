import { getCookie } from 'cookies-next';

interface ApiRequestOptions extends RequestInit {
  // Allow passing custom headers
  headers?: Record<string, string>;
  // Allow passing query parameters
  params?: Record<string, string | number | boolean | undefined>;
  // Response type (defaults to 'json')
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
}

/**
 * Fetches a CSRF token from the server
 */
async function fetchCSRFToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf', {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  const { token } = await response.json();
  return token;
}

/**
 * Makes an API request with CSRF protection
 */
async function apiClient<T = any>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    params,
    responseType = 'json',
    ...rest
  } = options;

  // Add CSRF token for state-changing requests
  const csrfToken = getCookie('csrf_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  // Prepare headers
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add CSRF token for non-GET requests
  if (method !== 'GET' && csrfToken) {
    requestHeaders['x-csrf-token'] = csrfToken as string;
  }

  // Remove content-type for FormData
  if (isFormData) {
    delete requestHeaders['Content-Type'];
  }

  // Build URL with query parameters
  let requestUrl = url;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      requestUrl += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const response = await fetch(requestUrl, {
    method,
    headers: requestHeaders,
    credentials: 'include', // Important for cookies
    ...rest,
  });

  // Handle 401 Unauthorized (token expired)
  if (response.status === 401) {
    // Try to refresh the token and retry
    try {
      const newToken = await fetchCSRFToken();
      if (newToken) {
        // Update the request headers with the new token
        const retryHeaders = {
          ...requestHeaders,
          'x-csrf-token': newToken,
        };

        const retryResponse = await fetch(requestUrl, {
          method,
          headers: retryHeaders,
          credentials: 'include',
          ...rest,
        });

        return handleResponse<T>(retryResponse, responseType);
      }
    } catch (error) {
      console.error('Failed to refresh CSRF token:', error);
      throw new Error('Session expired. Please refresh the page and try again.');
    }
  }

  return handleResponse<T>(response, responseType);
}

/**
 * Handles the API response
 */
async function handleResponse<T>(
  response: Response,
  responseType: 'json' | 'text' | 'blob' | 'arraybuffer' = 'json'
): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.message || 'An error occurred') as Error & {
      status?: number;
      code?: string;
    };
    error.status = response.status;
    error.code = errorData.code;
    throw error;
  }

  if (responseType === 'json') {
    return response.json();
  } else if (responseType === 'text') {
    return response.text() as unknown as T;
  } else if (responseType === 'blob') {
    return response.blob() as unknown as T;
  } else {
    return response.arrayBuffer() as unknown as T;
  }
}

export { apiClient, fetchCSRFToken };

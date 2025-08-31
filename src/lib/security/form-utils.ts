import { getCookie } from 'cookies-next';

export async function submitWithCSRF<T = any>(
  url: string, 
  data: Record<string, any>,
  options: RequestInit = {}
): Promise<T> {
  const csrfToken = getCookie('sb-csrf-token') as string;
  
  if (!csrfToken) {
    throw new Error('CSRF token not found in cookies');
  }

  const response = await fetch(url, {
    ...options,
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      ...options.headers,
    },
    body: JSON.stringify({
      ...data,
      _csrf: csrfToken, // Include in body for form submissions
    }),
    credentials: 'same-origin', // Include cookies with the request
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

// Helper for form submissions
export function handleFormSubmit<T = any>(
  url: string,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  return async (formData: FormData) => {
    try {
      const data = Object.fromEntries(formData.entries());
      const result = await submitWithCSRF<T>(url, data);
      options.onSuccess?.(result);
      return result;
    } catch (error) {
      console.error('Form submission error:', error);
      options.onError?.(error instanceof Error ? error : new Error('Submission failed'));
      throw error;
    }
  };
}

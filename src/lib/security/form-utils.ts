import { fetchWithCSRF } from '@/lib/http/csrf-interceptor';

interface FormSubmitOptions extends RequestInit {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Submit form data with CSRF protection
 * @param url The URL to submit to
 * @param data The form data to submit
 * @param options Additional fetch options and callbacks
 * @returns Promise with the response data
 */
export async function submitForm<T = any>(
  url: string,
  data: Record<string, any>,
  options: FormSubmitOptions = {}
): Promise<T> {
  const { onSuccess, onError, ...fetchOptions } = options;
  
  try {
    const response = await fetchWithCSRF(url, {
      ...fetchOptions,
      method: fetchOptions.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Request failed');
    }

    const result = await response.json();
    onSuccess?.(result);
    return result;
  } catch (error) {
    onError?.(error as Error);
    throw error;
  }
}

/**
 * React hook for form submissions with CSRF protection
 * @param url The URL to submit to
 * @param options Additional fetch options and callbacks
 * @returns A function to handle form submission
 */
export function useFormSubmit<T = any>(
  url: string,
  options: Omit<FormSubmitOptions, 'method' | 'body'> = {}
) {
  return async (data: Record<string, any>) => {
    return submitForm<T>(url, data, options);
  };
}

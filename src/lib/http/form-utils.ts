import { fetchWithCSRF } from './csrf-interceptor';

type FormSubmitOptions = {
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
};

/**
 * Helper function to handle form submissions with CSRF protection
 */
export async function submitForm<T = any>(
  url: string,
  formData: FormData,
  options: FormSubmitOptions = {}
): Promise<T> {
  const { method = 'POST', headers = {}, onSuccess, onError } = options;

  try {
    const response = await fetchWithCSRF(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Request failed with status ${response.status}`
      );
    }

    const data = await response.json().catch(() => ({}));
    
    if (onSuccess) {
      onSuccess(data);
    }
    
    return data;
  } catch (error) {
    console.error('Form submission error:', error);
    
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
    
    throw error;
  }
}

/**
 * Hook for form handling with CSRF protection
 */
export function useFormSubmit<T = any>() {
  const handleSubmit = async (
    url: string,
    formData: FormData,
    options: Omit<FormSubmitOptions, 'onSuccess' | 'onError'> = {}
  ): Promise<{ data?: T; error?: Error }> => {
    try {
      const data = await submitForm<T>(url, formData, options);
      return { data };
    } catch (error) {
      return { 
        error: error instanceof Error ? error : new Error(String(error)) 
      };
    }
  };

  return { handleSubmit };
}

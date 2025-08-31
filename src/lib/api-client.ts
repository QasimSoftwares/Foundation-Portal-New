import { ApiResponse } from '@/types/api';

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`/api/auth/${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'same-origin',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: data.error || {
          message: 'An unexpected error occurred',
          code: 'UNKNOWN_ERROR',
        },
      };
    }

    return { data };
  } catch (error) {
    console.error('API Error:', error);
    return {
      error: {
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

export const authApi = {
  signIn: (credentials: { email: string; password: string }) =>
    apiFetch('signin', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  signUp: (userData: { email: string; password: string; fullName: string }) =>
    apiFetch('signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  forgotPassword: (email: string) =>
    apiFetch('forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch('reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  verifyEmail: (token: string) =>
    apiFetch('verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};

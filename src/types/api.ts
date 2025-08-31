export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    email_verified: boolean;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    status: number;
  };
}

// Request types
export interface SignInRequest {
  email: string;
  password: string;
  csrfToken: string;
}

export interface SignUpRequest extends SignInRequest {
  fullName: string;
  acceptTerms: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
  csrfToken: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  csrfToken: string;
}

export interface VerifyEmailRequest {
  token: string;
  csrfToken: string;
}

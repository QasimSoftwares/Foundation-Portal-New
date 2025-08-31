# Authentication Architecture

This document outlines the architecture and structure of the authentication system in the Food Poverty Network (FPN) application.

## Overview

The authentication system follows Next.js 13+ App Router conventions and is built using Supabase for authentication. The system includes sign-in, sign-up, password reset, and email verification flows.

## Directory Structure

```
src/app/
├── (auth)/                     # Auth route group
│   ├── signin/                 # Sign-in page
│   │   └── page.tsx
│   ├── signup/                 # Sign-up page
│   │   └── page.tsx
│   ├── forgot-password/        # Forgot password page
│   │   └── page.tsx
│   ├── reset-password/         # Reset password page
│   │   └── page.tsx
│   └── verify-email/           # Email verification page
│       └── page.tsx
└── (dashboard)/                # Protected routes
    ├── dashboard/              # Dashboard page (protected)
    │   └── page.tsx
    └── profile/                # User profile (protected)
        └── page.tsx
```

## Key Features

### 1. App Router Convention
- All authentication pages follow Next.js 13+ App Router conventions
- Route groups `(auth)` and `(dashboard)` are used to organize related routes
- Client-side navigation is handled by Next.js `Link` components

### 2. Protected Routes
- Routes under `(dashboard)` are protected by authentication middleware
- Unauthenticated users are redirected to the sign-in page
- Authentication state is managed through Supabase auth

### 3. Authentication Flows

#### Sign In
- Email/password authentication
- Form validation with error handling
- Success/error toast notifications
- Redirect to dashboard on success

#### Sign Up
- Email/password registration
- Email verification requirement
- Form validation
- Success message with verification instructions

#### Password Reset
- Forgot password flow with email
- Secure token-based password reset
- Form validation and error handling

#### Email Verification
- Required after account creation
- Handles verification tokens
- Success/error states with appropriate feedback

## Legacy Pages

All legacy authentication pages under `/pages/auth/` have been removed to:
- Avoid routing conflicts
- Maintain consistency with App Router
- Simplify the codebase
- Improve maintainability

## Development Guidelines

1. **New Auth Pages**
   - Place all new authentication-related pages under `src/app/(auth)/`
   - Follow the existing file and component structure
   - Use the shared `AuthLayout` component for consistent styling

2. **Protected Routes**
   - Place protected pages under `src/app/(dashboard)/`
   - The middleware will handle authentication checks automatically

3. **Components**
   - Reuse existing auth components from `src/components/auth/`
   - Follow the design system and existing patterns

4. **State Management**
   - Use the `SessionProvider` for auth state
   - Access user session with `useSession()` hook

## Environment Variables

Ensure these environment variables are set in your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing

1. Test all authentication flows:
   - Sign up with new account
   - Verify email
   - Sign in with valid credentials
   - Forgot password flow
   - Protected route access

2. Test error cases:
   - Invalid credentials
   - Expired tokens
   - Network errors
   - Form validation

## Troubleshooting

- **Routing Issues**: Ensure all auth pages are under the `(auth)` route group
- **Authentication State**: Check the browser's developer tools for auth state changes
- **API Errors**: Monitor the browser console and Supabase logs for errors
- **Environment Variables**: Verify all required environment variables are set

## Future Improvements

- Add social login providers (Google, GitHub, etc.)
- Implement two-factor authentication
- Add rate limiting for auth endpoints
- Enhance security with additional checks
- Add account recovery options

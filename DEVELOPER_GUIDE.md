# FPN Developer Guide

**Last Updated**: September 14, 2025

This guide is the single source of truth for the FPN application's architecture, security, and development best practices. All other high-level documentation (`MASTER_GUIDE.md`, `AUTHENTICATION_ARCHITECTURE.md`, etc.) is now deprecated.

## 1. Core Principles

1.  **Single Source of Truth**: Logic for security and core features must be centralized. Avoid duplication.
2.  **Server-Side Enforcement**: All security checks (authentication, authorization, CSRF) are enforced on the server, primarily in the centralized middleware.
3.  **RPC-First Database Interaction**: Business logic should be encapsulated in PostgreSQL RPC functions. Avoid direct table queries from the application layer where possible.
4.  **Convention Over Configuration**: Adhere to Next.js App Router conventions and the established project structure.

## 2. System Architecture

### 2.1. Centralized Middleware (`src/middleware.ts`)

This is the most critical file for security. It intercepts all incoming requests and performs the following actions in order:

1.  **Applies Security Headers**: Sets headers like CSP, X-Frame-Options, etc.
2.  **Rate Limiting**: Enforces rate limits based on the endpoint's sensitivity.
3.  **Session Management**: Validates the user's session using secure, `httpOnly` cookies.
4.  **RBAC Enforcement**: Checks if the user has the required role for admin routes.
5.  **CSRF Protection**: Validates CSRF tokens for all state-changing requests (non-`GET`).

### 2.2. Layout System (`src/components/layout/PageLayout.tsx`)

All pages must use the `PageLayout` component to ensure a consistent UI. It provides the top navigation, sidebar, and consistent content padding.

**Usage**:
```tsx
import { PageLayout } from '@/components/layout/PageLayout';

export default function MyPage() {
  return (
    <PageLayout>
      {/* Page-specific content goes here */}
    </PageLayout>
  );
}
```

### 2.3. Client-Side State

Global client-side state is managed by providers in the root layout (`src/app/layout.tsx`):

-   **`AuthProvider`**: Manages the user session state (`session`, `isLoading`).
-   **`RoleHydrator` & `RoleProvider`**: Manages the user's available roles and the currently active role.
-   **`CSRFProvider`**: Provides the CSRF token to client components (though this is largely handled automatically).

## 3. Security Implementation

### 3.1. Session Management

-   **Handled by**: Supabase Auth via `createServerClient` in `src/middleware.ts`.
-   **Mechanism**: Secure, `httpOnly` cookies (`sb-access-token`, `sb-refresh-token`).
-   **Client Access**: Use the `useAuth()` hook from `src/contexts/AuthContext.tsx` to get the current session.

### 3.2. Role-Based Access Control (RBAC)

-   **Single Source of Truth**: `src/lib/security/roles.ts`.
-   **Role Fetching**: Always use `fetchUserRoles(userId)` to get a user's roles. This function includes caching and retry logic.
-   **Role Checking**: Use `isAdmin(roles)`, `hasRole(roles, 'role')`, and `getHighestRole(roles)` for authorization logic.
-   **Dashboard Routing**: Use `getDashboardPath(role)` from the same module to get the correct dashboard URL for a role. This is sourced from `src/config/routes.ts`.

### 3.3. Active Role Switching

-   **Mechanism**: The active role is stored in a secure, `httpOnly` cookie named `active-role`, which is set by the server.
-   **Triggering a Switch**: The `RoleSwitcher` component calls the `/api/role/switch` endpoint.
-   **Client-Side Update**: After the API call, the client should use `router.push()` to navigate to the new dashboard and `router.refresh()` to ensure all server components re-render with the new role. **Do not use `window.location.href` or `localStorage` for this process.**

### 3.4. CSRF Protection

-   **Enforcement**: Handled automatically by `src/middleware.ts` for all non-`GET` requests.
-   **Mechanism**: Double-submit cookie pattern. The middleware validates the `X-CSRF-Token` header against the `sb-csrf-token` cookie.
-   **Frontend Implementation**: For `fetch` requests, the token must be read from the cookie and included in the `X-CSRF-Token` header. For forms, a hidden input should be used.

### 3.5. Rate Limiting

-   **Enforcement**: Handled automatically by `src/middleware.ts`.
-   **Configuration**: Tiers are defined in `src/lib/security/rateLimit.ts`.

## 4. Development Best Practices

### 4.1. Creating API Routes

1.  **Location**: All API routes must be in the `src/app/api/` directory.
2.  **Supabase Client**: Use `createServerClient` from `@supabase/ssr` for all server-side Supabase interactions. Do not use `@supabase/auth-helpers-nextjs`.
3.  **Security**: Handlers for `POST`, `PUT`, `PATCH`, and `DELETE` must be in separate, named exports. Do not re-export a `GET` handler for state-changing methods.

    ```typescript
    // GOOD: Separate handlers
    export async function GET(request: Request) { /* ... */ }
    export async function POST(request: Request) { /* ... */ }

    // BAD: Bypasses CSRF protection
    // export { GET as POST };
    ```

### 4.2. Creating Pages

1.  **Location**: Create new pages within the `src/app` directory, using route groups `(auth)` for public auth pages and `(dashboard)` or role-specific directories for protected pages.
2.  **Layout**: Wrap all page content in the `<PageLayout>` component.

### 4.3. Accessing Session and Role Data

-   **Client Components**: 
    -   Use `useAuth()` to get session information.
    -   Use `useRoleContext()` to get the user's roles and active role.
-   **Server Components & API Routes**:
    -   Create a Supabase client using `createServerClient`.
    -   Call `supabase.auth.getSession()` and `supabase.auth.getUser()`.
    -   Call `fetchUserRoles(userId)` to get roles.

## 5. Deprecated Files & Patterns

-   **Files to Delete/Ignore**: 
    -   `MASTER_GUIDE.md`
    -   `AUTHENTICATION_ARCHITECTURE.md`
    -   `AUTHENTICATION_IMPLEMENTATION.md`
    -   `docs/SECURITY.md`
    -   `docs/ROLE_MANAGEMENT.md`
    -   `src/lib/supabase/middleware.ts`
-   **Patterns to Avoid**:
    -   Creating Supabase clients with `createRouteHandlerClient`.
    -   Using `localStorage` or `window.location` for role switching.
    -   Duplicating any logic already present in `src/lib/security/` or `src/config/`.
    -   Performing direct database queries from API routes instead of using RPC functions.

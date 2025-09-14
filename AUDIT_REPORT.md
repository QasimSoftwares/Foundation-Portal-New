# Codebase Audit Report - September 14, 2025

This report details the findings of a comprehensive audit of the FPN codebase, focusing on centralization, consistency, and security. The audit was conducted to verify compliance with documented standards and identify areas for improvement.

## 1. Executive Summary

The application has a strong foundation with a centralized middleware (`src/middleware.ts`) that correctly handles most security concerns, including session management, CSRF protection, rate-limiting, and RBAC. The recent adoption of a `PageLayout` component has also improved UI consistency.

However, the audit identified several critical and high-priority issues that undermine these strengths:
- **Inconsistent Supabase Client Instantiation**: Multiple, conflicting client libraries and patterns are in use.
- **Duplicated and Hardcoded Logic**: Key business logic, such as role-to-dashboard routing, is duplicated across the client and server.
- **Confusing State Management**: The `active-role` is managed by both a client-side `localStorage` item and a server-side `httpOnly` cookie, leading to complex and buggy workarounds like forced page reloads.
- **Security Vulnerability**: A critical vulnerability exists in the `/api/profile` route that bypasses CSRF protection for state-changing operations.
- **Outdated Documentation**: The project's documentation is fragmented, outdated, and contains conflicting information.

This report provides detailed findings and actionable recommendations to address these issues.

## 2. Detailed Findings and Recommendations

### 2.1. Centralized Middleware (Compliance: High)

**Finding**: `src/middleware.ts` is the single source of truth for request handling and security. It correctly enforces RBAC, CSRF protection, and rate-limiting. The deprecated `src/lib/supabase/middleware.ts` correctly throws errors on use.

**Recommendation**: No action needed. The current middleware is well-implemented.

### 2.2. API Routes (Compliance: Medium)

**Finding**: While most API routes correctly rely on the middleware for protection, there are significant inconsistencies:

1.  **Inconsistent Supabase Clients**: 
    - Most routes use `createServerClient` from `@supabase/ssr`.
    - `/api/profile/route.ts` uses the deprecated `createRouteHandlerClient` from `@supabase/auth-helpers-nextjs`.
2.  **Direct Database Access**: 
    - `/api/profile/route.ts` performs a direct table read (`from('profiles').select('*')`), violating the documented "RPC-First" principle.
3.  **Critical Security Vulnerability**:
    - `/api/profile/route.ts` exports its `GET` handler as `POST`, `PUT`, and `DELETE`. This allows state-changing requests to bypass the middleware's CSRF protection, which only targets non-`GET` methods.

**Recommendations**:

1.  **High Priority**: Immediately refactor `/api/profile/route.ts` to separate `GET`, `POST`, `PUT`, and `DELETE` handlers. Ensure all state-changing methods are properly protected.
2.  **Medium Priority**: Refactor all API routes to use a single, consistent method for creating the Supabase client (preferably `createServerClient` from `@supabase/ssr`).
3.  **Low Priority**: Refactor the profile route to use an RPC function for fetching profile data instead of direct table access.

### 2.3. Client-Side State and Providers (Compliance: Low)

**Finding**: The client-side providers contain duplicated logic and confusing state management patterns.

1.  **Duplicated Logic in `AuthContext`**: The `onAuthStateChange` handler in `AuthContext.tsx` contains hardcoded logic to determine a user's dashboard path. This logic is already centralized in `src/lib/security/roles.ts` (`getDashboardPath`).
2.  **Conflicting `active-role` Management**: 
    - The `RoleSwitcher` component writes the active role to `localStorage`.
    - The server-side middleware and documentation refer to an `httpOnly` `active-role` cookie.
    - This conflict forces the `RoleSwitcher` to use `window.location.href` for a full page reload to sync state, resulting in a poor user experience.

**Recommendations**:

1.  **High Priority**: Remove the hardcoded dashboard path logic from `AuthContext.tsx`. It should call an API endpoint or use the centralized `getDashboardPath` function if possible on the client.
2.  **High Priority**: Establish a single source of truth for the `active-role`. The recommended approach is to **rely solely on the `httpOnly` cookie set by the server**. 
    - Refactor the `RoleSwitcher` to call the `/api/role/switch` endpoint and then use `router.push()` and `router.refresh()` to navigate and re-render server components, eliminating the need for `localStorage` and `window.location.href`.

### 2.4. Layout and App Router Compliance (Compliance: High)

**Finding**: The project correctly uses the Next.js App Router. The recent introduction of the `PageLayout` component has been successfully applied to the `admin`, `dashboard`, and `profile` layouts, ensuring a consistent look and feel.

**Recommendation**: No action needed. Continue to use the `PageLayout` for all new pages.

### 2.5. Documentation (Compliance: Low)

**Finding**: The documentation is severely fragmented and contains outdated and conflicting information. Files like `MASTER_GUIDE.md`, `AUTHENTICATION_ARCHITECTURE.md`, and `SECURITY.md` all cover similar topics with different details, making it impossible for a developer to know the correct implementation pattern.

**Recommendation**: **High Priority**: Create a single, consolidated `DEVELOPER_GUIDE.md` that serves as the new source of truth. This guide should be based on the findings of this audit and the recommended best practices. All other high-level documentation files should be marked as deprecated or deleted.

## 3. Summary of Recommendations by Priority

### Critical (Address Immediately)
1.  **Fix CSRF Vulnerability**: Separate the `GET` and `POST`/`PUT`/`DELETE` handlers in `/api/profile/route.ts`.

### High Priority
1.  **Consolidate `active-role` Management**: Remove `localStorage` usage in `RoleSwitcher` and rely on the server-set `httpOnly` cookie and Next.js router for state updates.
2.  **Remove Duplicated Logic**: Refactor `AuthContext.tsx` to use centralized helpers for dashboard path resolution.
3.  **Consolidate Documentation**: Create a single `DEVELOPER_GUIDE.md` and deprecate all other conflicting documents.

### Medium Priority
1.  **Standardize Supabase Client**: Refactor all API routes to use a single, consistent client creation pattern.

### Low Priority
1.  **Adhere to RPC-First Principle**: Update the profile API to use an RPC function instead of direct table access.

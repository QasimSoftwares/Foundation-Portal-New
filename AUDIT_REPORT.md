# Codebase Audit Report - September 15, 2025

This report details the findings of a comprehensive audit of the FPN codebase, focusing on compliance with the principles outlined in `DEVELOPER_GUIDE.md`. The audit was conducted to verify the implementation of architectural standards and identify deviations.

## 1. Executive Summary

**Overall Compliance: Low**

The application's architecture is fundamentally undermined by critical security and architectural violations. While some components and API routes adhere to the documented standards, there is a widespread and systemic failure to comply with core principles, leading to significant security risks and maintainability issues.

The most severe findings include:

1.  **Critical Security Vulnerability (`SECURITY DEFINER`)**: A vast number of database functions are created with `SECURITY DEFINER`, which bypasses all Row-Level Security (RLS) policies. This is a direct and critical violation of the `DEVELOPER_GUIDE.md` and exposes the application to unauthorized data access.
2.  **Decentralized and Insecure RBAC**: Role-based access control logic is duplicated and inconsistently implemented on the client side, particularly in the `ProfileTabs` and `NonAdminSidebar` components. This bypasses the centralized RBAC system and creates multiple sources of truth for authorization.
3.  **Inconsistent Data Access**: Multiple API routes and client-side components perform direct table queries, violating the "RPC-First" principle. This decentralizes business logic and bypasses database-level security.
4.  **Architectural Inconsistencies**: The codebase contains multiple conflicting patterns for Supabase client instantiation, session management (including the use of `localStorage` and `window.location.href`), and CSRF token handling.

This report provides detailed findings and actionable recommendations to address these severe issues.

## 2. Detailed Findings and Recommendations

### 2.1. Database (Compliance: Critical Risk)

**Finding**: The audit identified a widespread and critical violation of the database security model. Numerous RPC functions and triggers across dozens of migration files are created with `SECURITY DEFINER` instead of the required `SECURITY INVOKER`. This allows these functions to execute with the privileges of their owner, completely bypassing all Row-Level Security policies.

**Recommendation**:

1.  **Critical Priority**: Immediately audit every database function and trigger. Replace all instances of `SECURITY DEFINER` with `SECURITY INVOKER` unless there is a documented and approved exception. This is the single most critical action required to secure the application.

### 2.2. API Routes (Compliance: Low)

**Finding**: While many routes are compliant, several key routes violate core principles:

1.  **Direct Database Access**: `/api/admin/debug/route.ts` and `/api/auth/sessions/route.ts` perform direct table queries, violating the "RPC-First" principle.
2.  **Inconsistent Client Instantiation**: `/api/auth/refresh/route.ts` and `/api/auth/signin/route.ts` import the client-side Supabase instance, a major architectural violation.
3.  **Insecure Data Exposure**: `/api/auth/signin/route.ts` exposes session tokens in the response body, and `/api/csrf/route.ts` exposes the CSRF token. This contradicts the `httpOnly` cookie strategy.
4.  **Inefficient User Check**: `/api/auth/signup/route.ts` uses an inefficient and insecure `listUsers` call to check for existing users.

**Recommendations**:

1.  **High Priority**: Refactor all API routes to use RPC functions for all database interactions.
2.  **High Priority**: Remove all imports of the client-side Supabase client from server-side API routes.
3.  **Medium Priority**: Refactor the sign-in route to rely exclusively on `httpOnly` cookies for session management, removing tokens from the response body.

### 2.3. Client-Side Components & State (Compliance: Low)

**Finding**: Client-side components contain significant architectural violations:

1.  **Decentralized RBAC**: `ProfileTabs.tsx` and `NonAdminSidebar.tsx` implement their own client-side RBAC logic, bypassing the centralized helpers and creating a separate, insecure source of truth for authorization.
2.  **Insecure State Management**: `RoleHydrator.tsx` uses `localStorage` and `window.location.reload()`, both of which are explicitly forbidden by the `DEVELOPER_GUIDE.md`.
3.  **Direct RPC Calls**: `RequestHandler.tsx` makes a direct RPC call from the client, bypassing the API layer and creating an inconsistent data-fetching pattern.
4.  **Duplicated Logic**: `PasswordStrengthIndicator.tsx` and `PersonalInfoTab.tsx` contain hardcoded logic that should be sourced from centralized constants.

**Recommendations**:

1.  **High Priority**: Refactor `ProfileTabs.tsx` and `NonAdminSidebar.tsx` to remove all client-side RBAC logic. The visibility of UI elements should be determined by data fetched from a secure API endpoint that uses the centralized RBAC system.
2.  **High Priority**: Remove all usage of `localStorage` and `window.location.href` from the application, particularly in `RoleHydrator.tsx` and `supabase-provider.tsx`.
3.  **Medium Priority**: Refactor `RequestHandler.tsx` to fetch all data through secure API routes instead of making direct RPC calls.

### 2.4. Documentation (Compliance: High)

**Finding**: The `DEVELOPER_GUIDE.md` is comprehensive and serves as an excellent single source of truth. The primary issue is the codebase's widespread non-compliance with this guide.

**Recommendation**: No action needed on the guide itself. The focus should be on bringing the codebase into compliance with the existing documentation.

## 3. Summary of Recommendations by Priority

### Critical (Address Immediately)
1.  **Fix `SECURITY DEFINER` Vulnerability**: Audit all database functions and replace `SECURITY DEFINER` with `SECURITY INVOKER`.

### High Priority
1.  **Centralize RBAC**: Remove all client-side RBAC logic from components.
2.  **Eliminate Insecure Patterns**: Remove all usage of `localStorage`, `window.location.href`, and direct RPC calls from the client.
3.  **Secure API Data Flow**: Ensure all database interactions from APIs use RPC functions and that no client-side code is imported on the server.

### Medium Priority
1.  **Standardize Session Management**: Ensure all authentication flows rely exclusively on `httpOnly` cookies and do not expose tokens in API responses.

### Low Priority
1.  **Remove Duplicated Logic**: Refactor components to use centralized constants and helpers.

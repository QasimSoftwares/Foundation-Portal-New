# Supabase Usage Audit Report

This report details the findings of an audit into the Supabase client usage, event handling, and session management within the codebase. The audit was initiated in response to warnings about multiple GoTrue/Supabase client events being registered and insecure session handling.

## 1. Supabase Client Instantiation

**Finding:** The primary issue is the existence of multiple, conflicting client implementations. Client creation is not centralized, leading to redundant and inefficient client instantiation across the application.

*   **`src/lib/supabase/client.ts`**: Correctly implements a singleton pattern for the client-side client. This should be the single source of truth for all client-side Supabase interactions.
*   **`src/lib/supabase/server.ts`**: Correctly creates server-side clients using `createServerComponentClient`. This should be the standard for all server-side logic.
*   **`src/lib/supabaseClient.ts`**: This file is a major source of problems. It duplicates the functionality of the other two files and exports multiple client creation functions without a singleton pattern. It also instantiates clients at the module level, causing a new client to be created whenever the file is imported.
*   **`src/lib/security/roles.ts`**: This utility file creates its own Supabase clients on the fly within the `fetchUserRoles` and `startRoleChangeListener` functions, bypassing any centralized client.

**Recommendation:**

1.  **Deprecate `src/lib/supabaseClient.ts`**: This file should be removed. All imports from this file should be updated to point to the correct centralized clients (`src/lib/supabase/client.ts` for client-side code and `src/lib/supabase/server.ts` for server-side code).
2.  **Refactor `src/lib/security/roles.ts`**: The `fetchUserRoles` and `startRoleChangeListener` functions should be refactored to accept a Supabase client instance as an argument, or they should import the singleton client directly. They should not be creating their own clients.

## 2. Auth Event Handling

**Finding:** There are three separate `onAuthStateChange` listeners, which is the direct cause of the "multiple GoTrue/Supabase client events being registered" warning.

*   **`src/lib/hooks/useUser.ts`**: Sets up a listener to update the user state.
*   **`src/components/providers/supabase-provider.tsx`**: The main provider, which also sets up a listener.
*   **`src/components/providers/AuthProvider.tsx`**: A redundant provider that duplicates the functionality of `supabase-provider.tsx`.

**Recommendation:**

1.  **Consolidate Auth Providers**: The `AuthProvider.tsx` is redundant and should be removed. The `supabase-provider.tsx` should be the single source of truth for session and user state management.
2.  **Centralize `onAuthStateChange`**: The `onAuthStateChange` listener should only be set up once, inside the main `SupabaseProvider`. The `useUser` hook should consume the user state from the provider's context, not set up its own listener.

## 3. Session and User Fetching

**Finding:** `getSession()` and `getUser()` calls are scattered throughout the codebase, with no centralized utility being used consistently. This leads to duplicated logic, performance issues, and the security warning about using `getSession()` without `getUser()` for validation.

*   **Direct Calls**: API routes, pages, and the middleware are all making direct calls to `supabase.auth.getSession()` and `supabase.auth.getUser()`.
*   **Inconsistent Implementations**: `src/lib/supabase/server.ts` provides centralized `getSession` and `getUser` functions, but they are not used everywhere. The middleware, for example, re-implements the same logic.

**Recommendation:**

1.  **Enforce Centralized Utilities**: All parts of the application should use the `getSession` and `getUser` functions exported from `src/lib/supabase/server.ts` for server-side logic. For client-side logic, a custom hook (like the existing `useUser` or a new `useSession` hook) should be used to get session and user data from the `SupabaseProvider`'s context.
2.  **Refactor the Middleware**: The middleware should be updated to use the centralized `getSession` and `getUser` functions.

## Summary of Recommendations

1.  **Centralize Supabase Client**: Remove `src/lib/supabaseClient.ts` and refactor all code to use the singleton clients from `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts`.
2.  **Consolidate Auth State Management**: Remove the redundant `AuthProvider.tsx` and the `onAuthStateChange` listener from `useUser.ts`. The `SupabaseProvider` should be the single source of truth.
3.  **Centralize Session/User Fetching**: Refactor all direct calls to `getSession` and `getUser` to use centralized utilities and hooks.

By implementing these changes, you will resolve the warnings, improve the security and performance of your application, and make the codebase easier to maintain.

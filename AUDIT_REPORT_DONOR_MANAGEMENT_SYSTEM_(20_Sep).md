# Audit Report: Donor Management System (20 Sep)

This report provides a comprehensive audit of the web application based on the standards and best practices defined in `DEVELOPER_GUIDE.md`.

---

## 1. Centralized Session Management

- **✅ Correct Centralization**: Session management is correctly centralized in `src/middleware.ts`, which uses the approved `createServerClient` from `@supabase/ssr`. This ensures all requests are consistently handled.
- **⚠️ Deprecated Clients Found**: The codebase contains multiple instances of deprecated Supabase clients.
  - **File**: `src/lib/supabase/server.ts`
  - **Issue**: Uses `createServerComponentClient` from `@supabase/auth-helpers-nextjs`, which is explicitly forbidden by the developer guide.
  - **File**: `src/lib/supabase-server.ts`
  - **Issue**: Re-exports the deprecated client, compounding the problem.
  - **File**: `src/lib/security/roles.ts`
  - **Issue**: Imports the browser-only client, creating a fragile dependency for server-side execution.

**📌 Recommendation**: Remove `src/lib/supabase/server.ts` and `src/lib/supabase-server.ts`. Refactor any code that uses them to rely on the centralized client passed from the middleware or to use the approved client helper for server components.

---

## 2. RBAC & Security

- **✅ Correct `is_admin` Implementation**: The `is_admin` function is correctly implemented with both `SECURITY INVOKER` and `SECURITY DEFINER` versions for RLS and RPCs, respectively.
- **✅ Correct RLS on Donations**: Row-Level Security policies on the `donations` and `donation_requests` tables correctly restrict donor access to their own records.
- **⚠️ Critical Flaw in Receipt Access**: The RLS policy for the `receipts` storage bucket is insecure.
  - **Policy**: `Allow authenticated read access to receipts`
  - **Issue**: It allows **any authenticated user** to download **any receipt** if they can guess the file path. There is no ownership check.
  - **Confirmation**: The `/api/admin/donations/approve` endpoint returns the raw, non-expiring storage path, directly exposing this vulnerability.

**📌 Recommendation**: The storage read policy must be updated to check for ownership. This can be done by joining the `donations` table and comparing the `donor_id` to the current user's ID. Additionally, the API should return a time-limited, signed URL for downloads instead of the raw path.

---

## 3. CSRF & Rate Limiting

- **✅ Correct Implementation**: Both CSRF protection (using the double-submit cookie pattern) and rate limiting are correctly and centrally implemented in `src/middleware.ts`.

---

## 4. RPC Usage & Data Fetching

- **✅ Strong RPC-First Approach**: The application correctly uses RPC functions for most of its database logic, particularly for mutations like approving donations.
- **⚠️ Minor Deviation**: The `/api/admin/donations/approve` route contains a direct table query (`supabase.from('donations').select('*')`) to fetch the final record. While safe due to RLS, this deviates from the guide's preference for RPCs.

**📌 Recommendation**: Replace the direct query with a dedicated RPC function (e.g., `get_donation_by_id`) to maintain consistency.

---

## 5. Frontend Consistency

- **✅ Consistent Layout and Components**: Both the admin and donor dashboards are designed to be used within the `PageLayout` component. They also share common components like `MetricCard`, ensuring a consistent look and feel.

---

## 6. Developer Guide Compliance

- **✅ Strong Alignment**: The project shows strong alignment with the `DEVELOPER_GUIDE.md` in most areas, including middleware-based security, RPC-first design, and frontend structure.
- **⚠️ Major Deviations**: The primary deviations are the use of deprecated Supabase clients and the critical security flaw in receipt handling.

---

## Summary of Findings

| Area | Status | Notes |
| --- | :---: | --- |
| Centralized Session Management | ⚠️ | Deprecated clients exist, but middleware is correct. |
| RBAC & Security | ⚠️ | **Critical receipt download vulnerability.** RLS on tables is good. |
| CSRF & Rate Limiting | ✅ | Correctly implemented in middleware. |
| RPC Usage & Data Fetching | ✅ | Strong RPC-first approach, with only minor deviations. |
| Frontend Consistency | ✅ | Good component reuse and consistent design. |

### Priority Recommendations:

1.  **Fix the receipt download vulnerability immediately.** This is a critical data leak.
2.  Refactor the code to remove all deprecated Supabase clients.

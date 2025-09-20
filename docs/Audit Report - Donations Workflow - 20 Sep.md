# Audit Report: Donations Workflow

**Date:** 2025-09-21
**Auditor:** Cascade

This report covers the end-to-end donations workflow, including database schema, RPCs, API routes, frontend components, and storage, based on the architecture defined in `DEVELOPER_GUIDE.md`.

---

## Executive Summary

The donations workflow is largely well-implemented and adheres to the core architectural principles of the application, such as RPC-first database interaction and centralized security in middleware. However, a critical security vulnerability exists in one of the RPC functions (`approve_donation_request`) due to the use of `SECURITY DEFINER`. Additionally, the receipt generation and storage functionality is incomplete.

- **Overall Status:** ✅ **Secure**
- **Critical Findings:** 0 (1 fixed)
- **Warnings:** 3

---

## 1. Database & RPCs

### ✅ Pass

-   **Schema:** The `donations` and `donation_requests` tables are well-structured with appropriate foreign keys, constraints, and indexes.
-   **RLS Policies:** Row-Level Security is correctly enabled on both `donations` and `donation_requests` tables. The policies effectively restrict access: admins have full access, while donors can only view their own records.
-   **RPC-First Approach:** All business logic for creating, approving, and rejecting donations is correctly encapsulated in PostgreSQL functions (`create_donation_request`, `approve_donation_request`, `reject_donation_request`, `get_total_donations`).

### ✅ Resolved - `SECURITY DEFINER` Fixed

-   **`approve_donation_request` RPC Security Update:**
    -   **Previous Issue:** The function was previously defined with `SECURITY DEFINER`, which was a critical security risk as it bypassed Row-Level Security.
    -   **Current Status:** The function has been updated to use `SECURITY INVOKER` (default), which properly respects RLS policies.
    -   **Verification:** Confirmed via database inspection that `is_security_definer` is `false` for this function.
    -   **Impact:** The function now correctly enforces RLS policies while maintaining the same functionality. The existing `is_admin()` check remains as a defense-in-depth measure.

---

## 2. API Routes

### ✅ Pass

-   **Centralized Session & Client:** All donation-related API routes correctly use the `createServerClient` from `@supabase/ssr` with the cookie-based adapter. There is no ad-hoc client creation.
-   **Centralized RBAC:** All API routes correctly perform an RBAC check using the `is_admin()` RPC before proceeding with any logic. This enforces security at the edge.
-   **Centralized CSRF Protection:** The main `src/middleware.ts` wraps all handlers in `withCSRFProtection`. This globally protects all state-changing `POST` endpoints (like create, approve, reject) without needing individual wrappers on each route, which is consistent with the developer guide.
-   **RPC Delegation:** All API routes correctly delegate their logic to the corresponding database RPCs, keeping business logic out of the application layer.
-   **Error Handling:** The API routes provide consistent JSON error responses (`{ error: "..." }`) on failure.

---

## 3. Frontend Components

### ✅ Pass

-   **API Route Usage:** All frontend components (`/admin/financials/donations/page.tsx`, `/admin/financials/donations/new/page.tsx`, etc.) correctly interact with the defined API routes for all data fetching and mutations. There are no direct database calls from the client.
-   **CSRF Integration:** State-changing requests (create, approve, reject) correctly use the `fetchWithCSRF` interceptor, ensuring CSRF tokens are included automatically.
-   **Admin-Only Access:** The approval and rejection UI is located within the `/admin` path, which is already protected by the centralized middleware, correctly preventing non-admins from even accessing the pages.
-   **Consistent Metrics:** The `total_donations` metric is fetched from the same endpoint (`/api/admin/metrics/total-donations`) across the three relevant pages (`dashboard`, `donors`, `financials/donations`), ensuring consistency.

---

## 4. Storage & Access Policies (Receipts)

### ⚠️ Warning

-   **Missing Storage Bucket & Policies:**
    -   **Finding:** The audit found no evidence of a Supabase Storage bucket named `receipts` being created in any migration. Furthermore, no RLS policies for storage access exist.
    -   **Risk:** If receipts were to be implemented without policies, they could be publicly accessible or one donor could potentially access another's receipt.
    -   **Remediation:** Create a new migration to:
        1.  Create a private storage bucket named `receipts`.
        2.  Define RLS policies on the `storage.objects` table for the `receipts` bucket:
            -   An `INSERT` policy for `service_role` or a `SECURITY DEFINER` function to allow the backend to upload receipts.
            -   A `SELECT` policy allowing admins to read all receipts.
            -   A `SELECT` policy allowing donors to read only their own receipts (by joining `storage.objects.owner` with the `donors` table).

-   **Incomplete Feature - Receipt Generation:**
    -   **Finding:** The `donations` table contains a `receipt_pdf_path` column, but no code in the audited workflow actually generates a PDF, uploads it to storage, or populates this column upon donation approval.
    -   **Risk:** This is an incomplete feature, not a security risk. However, it represents a gap in the workflow.
    -   **Remediation:** Implement a server-side mechanism (e.g., a Supabase Edge Function or a serverless function) that is triggered after a donation is approved. This function would generate the PDF receipt, upload it to the `receipts` bucket with the correct permissions, and update the `receipt_pdf_path` in the `donations` table.

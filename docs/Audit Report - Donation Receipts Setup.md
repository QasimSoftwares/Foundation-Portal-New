# Audit Report - Donation Receipts Setup

Date: 2025-09-21

## Summary
Implemented secure storage and API scaffolding for donation receipt PDFs, following centralized patterns in `DEVELOPER_GUIDE.md`:
- Singleton Supabase server client via `src/lib/supabase-server.ts`
- Centralized RBAC via `public.my_roles()` / `public.is_admin()`
- CSRF, rate limiting, and session validation handled by `src/middleware.ts`
- Centralized audit logging via `src/services/auditService.ts`

## Storage Setup
- Bucket created: `receipts`
- Folder: `donations/` for all donation receipts
- Filenames use UUID `donation_id` only, no donor-sensitive data
- Example path: `donations/{donation_id}.pdf`

Migration file:
- `supabase/migrations/20250921100000_setup_receipts_storage.sql`

## Storage Policies
RLS policies enforced on `storage.objects` (server-side):
- Admins (`public.is_admin()`): full read/write on `receipts` bucket under `donations/` prefix
- Donors: read-only for their own receipts, resolved via `public.donations` → `public.donors` linkage and extracting `{donation_id}` from filename

Policy highlights (see migration for full SQL):
- `receipts_admin_all`: `FOR ALL TO authenticated` using `public.is_admin()` and `bucket_id = 'receipts'` with `name` path prefix `donations/`
- `receipts_donor_read_own`: `FOR SELECT TO authenticated` and `EXISTS` subquery validating that `dn.donation_id` matches the extracted UUID and donor’s `user_id = auth.uid()`

## API Endpoint
Created route handler:
- `src/app/api/admin/donations/approve/route.ts`

Behavior:
1. Validates session via singleton Supabase server client
2. RBAC check via `public.my_roles()` (admin-only)
3. Calls `public.approve_donation_request(p_donation_request_id uuid)` RPC
4. Generates a placeholder PDF (A4 landscape, text: "Donation Receipt for {donation_id}") using `pdf-lib`
5. Uploads PDF to Supabase Storage at `receipts/donations/{donation_id}.pdf`
6. Updates `public.donations.receipt_pdf_path` with `donations/{donation_id}.pdf`
7. Returns `{ donation_id, receipt_pdf_path }`

Security notes:
- Adheres to centralized CSRF, session, and rate-limit enforcement via middleware
- No donor data in filenames
- Uses server-side checks and SQL policies; no client-side bypasses

## Audit Logging
The following events are logged via `src/services/auditService.ts`:
- `donation_approve_denied_no_session`
- `donation_approve_denied_not_admin`
- `donation_approve_failed`
- `donation_receipt_upload_failed`
- `donation_receipt_update_failed`
- `donation_receipt_uploaded`

Each log includes `reqId`, `userId` when available, and relevant identifiers.

## Dependencies
- Added `pdf-lib@^1.17.1` to `package.json` for PDF generation.

## Next Steps (Optional)
- Replace placeholder PDF with branded template and full donation metadata
- Add endpoint to allow donors to download their own receipts (enforced by storage policies)
- E2E tests for approval flow and access control

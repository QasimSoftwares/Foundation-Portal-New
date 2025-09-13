# RBAC Hybrid Dashboard TODO

## ✅ Already Implemented
- Role RPCs available: `get_user_roles`, `my_roles`, `is_user_admin` (see `supabase/migrations/*rbac*`).
- Central session management via `src/security/session/sessionManager.ts` and Next.js `src/middleware.ts`.
- Role-based sidebars:
  - `components/sidebar/AdminSidebar.tsx`
  - `components/sidebar/NonAdminSidebar.tsx`
  - `components/sidebar/Sidebar.tsx` (SSR)
- Centralized role utilities and caching:
  - `src/lib/security/roles.ts` (RPC-only fetching + 5-min TTL + invalidation + optional realtime)
  - `src/utils/roleUtils.ts` (`getHighestRole`, `getDashboardPathForRole`)
- Dashboard layout integrated with SSR Sidebar: `src/app/(dashboard)/layout.tsx`.

## ⚠️ Needs Cleanup/Refactor
- Replace any direct `user_roles` table reads with RPC-only (e.g., `src/middleware/roleService.ts` still queries table directly).
- Ensure all places determining admin use RPCs (middleware uses `is_user_admin`, OK).
- Consider enabling realtime role change listener at app init if deployment constraints allow.

## ❌ Missing (Must Add)
- Role-aware redirect in `middleware.ts` to send users to highest-role dashboard on `/signin` and `/dashboard`.
- Per-role dashboard pages under App Router:
  - `/admin/dashboard`, `/member/dashboard`, `/volunteer/dashboard`, `/donor/dashboard`, `/viewer/dashboard`.
- RoleSwitcher component to let users pick an allowed role and navigate accordingly.
- API endpoints:
  - `GET /api/roles` → fetch current user roles via RPC.
  - `POST /api/role/switch` → validate + set `active-role` cookie.
- SECURITY.md update documenting centralized RBAC patterns and cache behavior.

## Priority Order
1) Security: RPC-only fetching everywhere; middleware role-aware redirects; validate RoleSwitcher switches to a role the user owns.
2) Structure: centralize role helpers, de-duplicate checks; 5 dashboards with SSR layout.
3) UI: RoleSwitcher and clean sidebar variants.

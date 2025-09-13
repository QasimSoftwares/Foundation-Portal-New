/**
 * DEPRECATED FILE - DO NOT USE
 *
 * This legacy middleware has been replaced by the centralized implementation in `src/middleware.ts`.
 * All security concerns (RBAC, CSRF, rate limiting, auth) are enforced there.
 *
 * Any imports from this module must be removed. If you intentionally call any export here,
 * it will throw to prevent accidental usage.
 */

export function middleware(): never {
  throw new Error('Deprecated: Use centralized middleware in src/middleware.ts');
}

export const config = undefined as never;

export function withAuth(): never {
  throw new Error('Deprecated: Use centralized middleware in src/middleware.ts');
}

export function requireAdmin(): never {
  throw new Error('Deprecated: Use centralized RBAC in src/middleware.ts and src/lib/security/roles.ts');
}

export function requirePermission(): never {
  throw new Error('Deprecated: Use centralized RBAC in src/middleware.ts and src/lib/security/roles.ts');
}

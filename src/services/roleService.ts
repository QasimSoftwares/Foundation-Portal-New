/**
 * DEPRECATED FILE - DO NOT USE
 *
 * Express-style role service is not used in the Next.js App Router architecture.
 * Use centralized RBAC helpers in `src/lib/security/roles.ts` and middleware in `src/middleware.ts`.
 */

export const getMyRoles = () => {
  throw new Error('Deprecated: Use fetchUserRoles() from src/lib/security/roles.ts');
};

export const canI = () => {
  throw new Error('Deprecated: Use centralized RBAC utilities and middleware');
};

export const hasPermission = () => {
  throw new Error('Deprecated: Use centralized RBAC utilities and middleware');
};

export const isAdmin = () => {
  throw new Error('Deprecated: Use isAdmin() from src/lib/security/roles.ts');
};

export const requirePermission = () => {
  throw new Error('Deprecated: Use centralized middleware in src/middleware.ts');
};

export const requireAdmin = () => {
  throw new Error('Deprecated: Use centralized middleware in src/middleware.ts');
};

/**
 * DEPRECATED FILE - DO NOT USE
 *
 * This legacy session manager has been replaced by `src/security/session/sessionManager.ts`.
 * All session creation/validation must go through the centralized SessionManager there.
 */

export class SessionManager {
  constructor() {
    throw new Error('Deprecated: Use src/security/session/sessionManager.ts');
  }
}

// Deprecated legacy middleware/functions
export const verifyToken = () => {
  throw new Error('Deprecated: Use centralized session middleware in src/security/session/sessionMiddleware.ts');
};

export const requireRole = () => {
  throw new Error('Deprecated: Use RBAC via src/lib/security/roles.ts and centralized middleware');
};

export const requireAdmin = () => {
  throw new Error('Deprecated: Use RBAC via src/lib/security/roles.ts and centralized middleware');
};

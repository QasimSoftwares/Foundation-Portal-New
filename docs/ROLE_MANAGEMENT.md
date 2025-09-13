# Role-Based Access Control (RBAC) Implementation

This document outlines the centralized role management system implemented in the application, which provides a consistent and maintainable way to handle user roles and permissions.

## Core Concepts

### User Roles

Roles are defined in order of precedence (highest to lowest):

1. **Admin**: Full system access, including user management and system settings
2. **Member**: Regular authenticated users with basic access
3. **Volunteer**: Users with additional volunteer-related permissions
4. **Donor**: Users with donor-specific access
5. **Viewer**: Read-only access (default fallback role)

### Role Precedence

When a user has multiple roles, the highest role takes precedence for access control decisions. This ensures consistent and predictable behavior throughout the application.

## Implementation Details

### Centralized Role Helpers (`src/lib/security/roles.ts`)

This module provides core functionality for role management with built-in caching and retry mechanisms.

#### Key Functions

```typescript
// Fetch user roles with caching and retry logic
// Caches results for 5 minutes to reduce database load
async function fetchUserRoles(userId: string): Promise<UserRole[]>;

// Check if user has admin privileges
function isAdmin(roles: UserRole[]): boolean;

// Get the highest role from a list of roles based on precedence
function getHighestRole(roles: UserRole[]): UserRole;

// Check if user has a specific role or higher
function hasRole(roles: UserRole[], targetRole: UserRole): boolean;

// Get all valid roles for type safety
getAllRoles(): UserRole[];

// Validate if a role exists
isValidRole(role: string): role is UserRole;
```

#### Role Caching

Roles are cached in memory with a TTL (Time To Live) of 5 minutes to reduce database load. The cache is automatically invalidated when roles are updated.

#### Error Handling

- If role fetching fails, the system will retry up to 3 times with exponential backoff
- If all retries fail, the user is logged out for security reasons

### Route Configuration (`src/config/routes.ts`)

Centralized route definitions and role-based redirects:

```typescript
// Role-based dashboard paths
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  member: '/member/dashboard',
  volunteer: '/volunteer/dashboard',
  donor: '/donor/dashboard',
  viewer: '/dashboard',
};

// Role-based access control for routes
export const ROLE_ACCESS: Record<string, UserRole[]> = {
  '/admin': ['admin'],
  '/member': ['admin', 'member'],
  '/volunteer': ['admin', 'volunteer'],
  '/donor': ['admin', 'donor'],
  '/dashboard': ['admin', 'member', 'volunteer', 'donor', 'viewer'],
};

// Admin routes (protected by middleware)
export const ADMIN_ROUTES = {
  pages: ['/admin', '/admin/users', '/admin/settings'],
  api: ['/api/admin', '/api/users'],
};
```

### Middleware Integration

The middleware enforces role-based access control:

1. **Admin Routes**: Protected by checking user roles via `isAdmin()`
2. **Role-Based Redirects**: Users are redirected to their appropriate dashboard based on their highest role
3. **Error Handling**: Consistent error responses and logging

### Frontend Components

#### Sidebar (`components/sidebar/Sidebar.tsx`)

- Fetches and displays user roles
- Renders the appropriate sidebar based on user role
- Handles error states gracefully

### Role Switcher (Client UX)

- Location: `src/components/roles/RoleSwitcher.tsx`
- Provider: `src/components/roles/RoleProvider.tsx` (wrapped via `RoleHydrator` server component)
- Behavior:
  - Fetches roles via `/api/roles` which internally uses `fetchUserRoles(user.id)`.
  - Default active role comes from the server via `RoleHydrator` using `getHighestRole(roles)` or previously set cookie.
  - On selection, POSTs to `/api/role/switch` (validates with `fetchUserRoles`, `hasRole`). The server sets an httpOnly cookie `active-role` and returns the target dashboard.
  - Client navigates to the returned dashboard and calls `router.refresh()` to re-hydrate server state.
  - The `active-role` cookie is httpOnly; do NOT read it in the client. Middleware and server components use it.

### Rules and Guarantees

1. Default role = `getHighestRole(roles)` unless an `active-role` cookie is set and valid.
2. The switcher only shows roles the user actually has (no hardcoding).
3. The `active-role` cookie is the single source of truth for the selected role; it's set server-side and read in middleware.
4. Access control is enforced on the server by `src/middleware.ts` using roles from `src/lib/security/roles.ts`.
5. Dashboard mapping uses `ROLE_DASHBOARDS` from `src/config/routes.ts`.

### Server vs Client Responsibilities

- Server (Middleware):
  - Reads `active-role` httpOnly cookie.
  - Validates the cookie value against the user's roles from `fetchUserRoles`.
  - Redirects `/dashboard` and `/signin` to the correct role dashboard using `ROLE_DASHBOARDS`.

- Client (RoleProvider/RoleSwitcher):
  - Hydrates `initialRoles` and `initialActiveRole` via `RoleHydrator`.
  - Does NOT read `active-role` on the client (httpOnly).
  - Calls `/api/role/switch` to change role, then navigates and refreshes.

```typescript
// Example usage in a component
const { data: session } = useSession();
const roles = await fetchUserRoles(session.user.id);
const isUserAdmin = isAdmin(roles);
```

## Best Practices

1. **Always use the centralized role helpers** instead of direct role checks
2. **Cache role data** when possible to reduce database queries
3. **Handle loading and error states** when fetching roles
4. **Use the highest role** for UI decisions when multiple roles are present
5. **Log role-related errors** with appropriate context for debugging

## Error Handling

All role-related errors are logged with consistent formatting:

```
[Component] Error message (user: user-id): Error details
```

## Testing

Role-based functionality should be tested with various user roles to ensure:

1. Correct dashboard redirection
2. Proper sidebar rendering
3. Appropriate access control
## Role Switching

Users with multiple roles can switch between them using the role switcher component. The active role is stored in a secure, HTTP-only cookie.

### API Endpoint: `/api/role/switch`

```typescript
// Request
{
  "role": "volunteer"  // The role to switch to
}

// Response (200 OK)
{
  "success": true,
  "role": "volunteer",
  "redirectTo": "/volunteer/dashboard"
}
```

### Security Considerations

1. The API validates that the requested role is one of the user's assigned roles
2. The active role is stored in a secure, HTTP-only cookie with SameSite=Strict
3. Role changes are logged for audit purposes
4. The middleware enforces role-based access control on every request

## Best Practices

1. **Always check roles on the server** - Never rely solely on client-side role checks
2. **Use the highest role for access control** - When a user has multiple roles, the highest role should be used for access decisions
3. **Log role changes** - All role changes should be logged for audit purposes
4. **Validate roles** - Always validate roles against the list of valid roles
5. **Cache role lookups** - Use the built-in caching mechanism to reduce database load

## Error Handling and Fallback Behavior

- **Invalid Role**: If a user's active role becomes invalid (e.g., due to role revocation), they will be automatically switched to their highest available role
- **Missing Roles**: If a user has no roles assigned, they will be treated as unauthenticated
- **Session Expiry**: When a session expires, the user will be redirected to the login page
- **Access Denied**: If a user tries to access a route they don't have permission for, they will be redirected to their dashboard

## Monitoring and Logging

All role-related actions are logged using the security logger:

- Role assignments and revocations
- Role switching
- Access denied events
- Role validation failures

## Testing

When testing role-based functionality, ensure you test:

1. Users with single roles
2. Users with multiple roles
3. Role switching behavior
4. Access control for each role
5. Error conditions (invalid roles, expired sessions, etc.)

## Troubleshooting

### Common Issues

1. **Role not updating after switch**
   - Clear cookies and try again
   - Check the browser's developer tools for cookie issues
   - Verify the user has the role they're trying to switch to

2. **Access denied errors**
   - Verify the user's active role has the required permissions
   - Check for typos in route configurations
   - Ensure the middleware is properly configured

3. **Performance issues**
   - Check if role caching is enabled
   - Monitor database query performance
   - Consider implementing Redis for distributed caching in production

## Future Enhancements

1. **Fine-grained permissions** - Add more granular permissions within roles
2. **Role inheritance** - Allow roles to inherit permissions from other roles
3. **Temporary roles** - Add support for time-limited role assignments
4. **Audit logs** - Enhance logging for better compliance and debugging
5. **Role approval workflow** - Add approval workflows for role assignments

import { Database } from '@/types/supabase';
import createClient from '@/lib/supabase/client';
import { logger } from '@/lib/utils/logger';

// Use the singleton client
const supabase = createClient();

export type UserRole = 'admin' | 'member' | 'volunteer' | 'donor' | 'viewer';

type UserRoles = {
  is_admin?: boolean;
  is_member?: boolean;
  is_volunteer?: boolean;
  is_donor?: boolean;
  is_viewer?: boolean;
};

// Role hierarchy from highest to lowest precedence
const ROLE_PRECEDENCE: UserRole[] = ['admin', 'member', 'volunteer', 'donor', 'viewer'];

// Dashboard paths for each role
const ROLE_DASHBOARDS: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  member: '/member/dashboard',
  volunteer: '/volunteer/dashboard',
  donor: '/donor/dashboard',
  viewer: '/dashboard',
};

/**
 * Extracts roles from the RPC response or user metadata
 */
export function extractRoles(roleData: unknown): UserRole[] {
  if (!roleData) return ['viewer'];
  
  // Handle case where roleData is already an array of UserRole
  if (Array.isArray(roleData) && roleData.every(role => 
    typeof role === 'string' && ROLE_PRECEDENCE.includes(role as UserRole)
  )) {
    return roleData as UserRole[];
  }
  
  // Handle case where roleData is an object with role flags
  if (typeof roleData === 'object') {
    const roles: UserRole[] = [];
    const data = roleData as UserRoles;
    
    if (data.is_admin) roles.push('admin');
    if (data.is_member) roles.push('member');
    if (data.is_volunteer) roles.push('volunteer');
    if (data.is_donor) roles.push('donor');
    
    // Always include viewer role if is_viewer is true or if no other roles are present
    if (data.is_viewer || roles.length === 0) {
      roles.push('viewer');
    }
    
    return roles;
  }
  
  // Default to viewer role if roleData is in an unexpected format
  return ['viewer'];
}

/**
 * Gets the highest role from an array of roles based on precedence
 */
export function getHighestRole(roles: UserRole[]): UserRole {
  if (!Array.isArray(roles) || roles.length === 0) {
    return 'viewer';
  }
  return ROLE_PRECEDENCE.find(role => roles.includes(role)) || 'viewer';
}

/**
 * Gets the effective role for a user based on their available roles
 * This is the main function that should be used to determine a user's role
 */
export function getEffectiveRole(roles: UserRole[], activeRole?: UserRole | null): UserRole {
  if (activeRole && roles.includes(activeRole)) {
    return activeRole;
  }
  return getHighestRole(roles);
}

/**
 * Checks if a user has a specific role
 */
export function hasRole(roles: UserRole[], role: UserRole): boolean {
  return Array.isArray(roles) ? roles.includes(role) : false;
}

/**
 * Checks if a user has admin privileges
 */
export function isAdmin(roles: UserRole[]): boolean {
  return hasRole(roles, 'admin');
}

/**
 * Checks if a user has at least the specified role
 */
export function hasAtLeastRole(roles: UserRole[], minRole: UserRole): boolean {
  const userHighestRole = getHighestRole(roles);
  return ROLE_PRECEDENCE.indexOf(userHighestRole) <= ROLE_PRECEDENCE.indexOf(minRole);
}

/**
 * Gets the dashboard path for a role
 */
export function getDashboardPath(role: UserRole): string {
  return ROLE_DASHBOARDS[role] || '/dashboard';
}

/**
 * Gets the dashboard path for a user based on their roles
 */
export function getUserDashboardPath(roles: UserRole[]): string {
  const highestRole = getHighestRole(roles);
  return getDashboardPath(highestRole);
}

/**
 * Validates if a role is a valid UserRole
 */
export function isValidRole(role: string): role is UserRole {
  return ROLE_PRECEDENCE.includes(role as UserRole);
}

// Internal cache with TTL
const ROLE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry = {
  roles: UserRole[];
  expiresAt: number;
};

const roleCache = new Map<string, CacheEntry>();

/**
 * Cache for user roles to reduce database load
 */
export const rolesCache = {
  get(userId: string): UserRole[] | null {
    const entry = roleCache.get(`roles:${userId}`);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      roleCache.delete(`roles:${userId}`);
      return null;
    }
    return entry.roles;
  },
  
  set(userId: string, roles: UserRole[]): void {
    roleCache.set(`roles:${userId}`, { 
      roles, 
      expiresAt: Date.now() + ROLE_TTL_MS 
    });
  },
  
  invalidate(userId: string): void {
    roleCache.delete(`roles:${userId}`);
  },
  
  clearAll(): void {
    roleCache.clear();
  }
};

/**
 * Fetches user roles from the database with retry logic
 */
export type FetchUserRolesOptions = {
  accessToken?: string;
};

export async function fetchUserRoles(userId: string, opts: FetchUserRolesOptions = {}): Promise<UserRole[]> {
  // Try cache first unless an access token is provided (force fresh, authenticated read)
  if (!opts.accessToken) {
    const cached = rolesCache.get(userId);
    if (cached) return cached;
  }

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Use the singleton client with the provided access token if available
      const client = supabase;
      
      if (opts.accessToken) {
        await client.auth.setSession({
          access_token: opts.accessToken,
          refresh_token: ''
        });
      }

      const { data, error } = await client.rpc('get_user_roles', {
        p_user_id: userId,
      });

      if (error) throw error;

      const roles = extractRoles(data);
      rolesCache.set(userId, roles);
      return roles;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      lastError = error as Error;
      
      // Exponential backoff
      if (attempt < MAX_RETRIES - 1) {
        const delay = 100 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // On persistent error: safe fallback to viewer and cache briefly
  console.error('All retries failed, falling back to viewer role', lastError);
  const roles: UserRole[] = ['viewer'];
  rolesCache.set(userId, roles);
  return roles;
}

/**
 * Gets the redirect path for a user based on their highest role.
 */
export async function getRedirectPathForUser(userId: string): Promise<string> {
  try {
    const roles = await fetchUserRoles(userId);
    const highestRole = getHighestRole(roles);
    return getDashboardPath(highestRole);
  } catch (error) {
    console.error('Error getting redirect path for user:', error);
    return '/dashboard'; // Safe fallback
  }
}

/**
 * Fetches and validates user roles, returning the highest role
 */
export async function getUserHighestRole(userId: string): Promise<UserRole> {
  try {
    const roles = await fetchUserRoles(userId);
    return getHighestRole(roles);
  } catch (error) {
    console.error('Error getting user highest role:', error);
    return 'viewer';
  }
}

// Helpers to invalidate cache on security events
export function invalidateUserRoles(userId: string) {
  rolesCache.invalidate(userId);
}

export function invalidateAllRoles() {
  rolesCache.clearAll();
}

// Role change subscription (for real-time updates)
let roleChannelStarted = false;
let unsubscribeFn: (() => void) | null = null;

/**
 * Starts listening for role changes in real-time
 */
export async function startRoleChangeListener() {
  if (roleChannelStarted) return;
  
  // Use the singleton client

  const channel = supabase
    .channel('roles-changes')
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'user_roles' 
      },
      (payload: any) => {
        const row = payload.new || payload.old;
        const userId: string | undefined = row?.user_id;
        if (userId) {
          rolesCache.invalidate(userId);
        } else {
          // Fallback: clear all if unsure
          rolesCache.clearAll();
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions' },
      (payload: any) => {
        const row = payload.new || payload.old;
        const userId: string | undefined = row?.user_id;
        const revokedAt = row?.revoked_at;
        if (userId && revokedAt) {
          rolesCache.invalidate(userId);
        }
      }
    )
    .subscribe();

  unsubscribeFn = () => {
    try { supabase.removeChannel(channel); } catch {}
    roleChannelStarted = false;
  };

  roleChannelStarted = true;
}

export function stopRoleChangeListener() {
  if (unsubscribeFn) {
    unsubscribeFn();
    unsubscribeFn = null;
  }
}

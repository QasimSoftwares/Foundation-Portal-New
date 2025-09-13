"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { logger } from "@/lib/utils/logger";
import type { UserRole } from "@/lib/security/roles";
import { 
  getHighestRole, 
  getEffectiveRole, 
  hasAtLeastRole, 
  hasRole, 
  isAdmin, 
  isValidRole,
  getDashboardPath
} from "@/lib/security/roles";

// Shape of the role context
type RoleContextState = {
  // User's available roles
  roles: UserRole[];
  // Currently active role (can be different from highest role if user switched)
  activeRole: UserRole | null;
  // Loading state for role operations
  loading: boolean;
  // Any error that occurred during role operations
  error: string | null;
  // The effective role (active role if set, otherwise highest role)
  effectiveRole: UserRole | null;
  // Whether the user has admin privileges
  isAdmin: boolean;
  // Set the active role
  setActiveRole: (role: UserRole) => Promise<void>;
  // Refresh roles from the server and return the updated roles
  refresh: () => Promise<UserRole[]>;
  // Check if user has a specific role
  hasRole: (role: UserRole) => boolean;
  // Check if user has at least the specified role
  hasAtLeastRole: (role: UserRole) => boolean;
  // Get the dashboard path for the current role
  getDashboardPath: () => string;
};

const RoleContext = createContext<RoleContextState | undefined>(undefined);

// Helper to fetch JSON with error handling
async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers || {}),
      "Content-Type": "application/json",
    },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }
  
  return res.json() as Promise<T>;
}

type RoleProviderProps = {
  children: React.ReactNode;
  initialRoles?: UserRole[];
  initialActiveRole?: UserRole | null;
  session: Session | null; // Add session to props
};

export function RoleProvider({ children, initialRoles, initialActiveRole, session }: RoleProviderProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<UserRole[]>(initialRoles ?? []);
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(initialActiveRole ?? null);
  const [loading, setLoading] = useState<boolean>(!initialRoles);
  const [error, setError] = useState<string | null>(null);

  // Calculate derived state
  const effectiveRole = getEffectiveRole(roles, activeRole);
  const isUserAdmin = isAdmin(roles);

  // Log initial state in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('RoleProvider - Initial state:', { 
      initialRoles, 
      initialActiveRole,
      roles,
      activeRole,
      effectiveRole,
      isUserAdmin
    });
  }

  /**
   * Load roles from the server
   */
  const loadRoles = useCallback(async () => {
    logger.debug('Loading roles...');
    setLoading(true);
    setError(null);
    
    try {
      // Fetch roles from the API
      const data = await fetchJSON<{ roles: UserRole[] }>("/api/roles");
      const fetchedRoles = Array.isArray(data?.roles) ? data.roles : [];
      
          // Validate and type cast roles
      const validRoles = fetchedRoles
        .filter((role): role is UserRole => isValidRole(role));
      
      // If no valid roles, default to viewer
      const finalRoles: UserRole[] = validRoles.length > 0 ? validRoles : ['viewer'];
      
      // Update state with new roles
      setRoles(finalRoles);
      
      // Determine the active role
      let newActiveRole = activeRole;
      
      // If current active role is not valid with new roles, reset it
      if (activeRole && !finalRoles.includes(activeRole)) {
        newActiveRole = getHighestRole(finalRoles);
      }
      
      // If no active role is set, use the highest role
      if (!newActiveRole) {
        newActiveRole = getHighestRole(finalRoles);
      }
      
      // Update active role if it changed
      if (newActiveRole !== activeRole) {
        setActiveRoleState(newActiveRole);
      }
      
      logger.debug('Roles loaded successfully', { 
        roles: finalRoles, 
        activeRole: newActiveRole,
        previousActiveRole: activeRole
      });
      
      return finalRoles;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to load roles');
      const errorMessage = errorObj.message;
      logger.error('Error loading roles', { error: errorObj });
      setError(errorMessage);
      
      // Fallback to viewer role
      const fallbackRoles: UserRole[] = ['viewer'];
      setRoles(fallbackRoles);
      setActiveRoleState('viewer');
      
      return fallbackRoles;
    } finally {
      setLoading(false);
    }
  }, [activeRole]);
  
  /**
   * Set the active role
   */
  const setActiveRole = useCallback(async (role: UserRole) => {
    if (!isValidRole(role)) {
      logger.warn(`Attempted to set invalid role: ${role}`);
      return;
    }
    
    if (!roles.includes(role)) {
      logger.warn(`User does not have the role: ${role}`);
      return;
    }
    
    try {
      // Update the active role on the server
      await fetchJSON('/api/role/switch', {
        method: 'POST',
        body: JSON.stringify({ role })
      });
      
      // Update local state
      setActiveRoleState(role);
      logger.debug('Active role updated', { role });
      
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to switch role');
      logger.error('Failed to switch role', { error: errorObj });
      throw errorObj;
    }
  }, [roles]);
  
  /**
   * Check if user has a specific role
   */
  const checkRole = useCallback((role: UserRole): boolean => {
    return hasRole(roles, role);
  }, [roles]);
  
  /**
   * Check if user has at least the specified role
   */
  const checkAtLeastRole = useCallback((minRole: UserRole): boolean => {
    return hasAtLeastRole(roles, minRole);
  }, [roles]);
  
  /**
   * Get the dashboard path for the current role
   */
  const getCurrentDashboardPath = useCallback((): string => {
    return effectiveRole ? getDashboardPath(effectiveRole) : '/dashboard';
  }, [effectiveRole]);
  
  // Reload roles when the session changes (e.g., sign-in/out)
  useEffect(() => {
    if (session) {
      logger.debug('Session detected, loading roles...', { hasSession: true });
      void loadRoles();
    } else {
      // If there's no session, reset to a logged-out state.
      logger.debug('No session detected, resetting roles.');
      setRoles(['viewer']); // Default role for a guest
      setActiveRoleState('viewer');
      setLoading(false);
      setError(null);
    }
  }, [session, loadRoles]);
  
  // Context value
  const contextValue = useMemo(() => ({
    roles,
    activeRole,
    loading,
    error,
    effectiveRole,
    isAdmin: isUserAdmin,
    setActiveRole,
    refresh: async () => {
      const updatedRoles = await loadRoles();
      return updatedRoles;
    },
    hasRole: checkRole,
    hasAtLeastRole: checkAtLeastRole,
    getDashboardPath: getCurrentDashboardPath,
  }), [
    roles, 
    activeRole, 
    loading, 
    error, 
    effectiveRole, 
    isUserAdmin, 
    setActiveRole, 
    loadRoles, 
    checkRole, 
    checkAtLeastRole, 
    getCurrentDashboardPath
  ]);

  return (
    <RoleContext.Provider value={contextValue}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoleContext(): RoleContextState {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRoleContext must be used within RoleProvider");
  return ctx;
}

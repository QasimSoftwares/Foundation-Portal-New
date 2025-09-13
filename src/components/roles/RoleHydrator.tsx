'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RoleProvider } from "@/components/roles/RoleProvider";
import { 
  fetchUserRoles, 
  getHighestRole, 
  type UserRole, 
  isValidRole,
  getDashboardPath
} from "@/lib/security/roles";
import { logger } from "@/lib/utils/logger";
import { useAuth } from '@/contexts/AuthContext';

// Constants
const ACTIVE_ROLE_KEY = 'active-role';
const DEFAULT_ROLE: UserRole = 'viewer';

export default function RoleHydrator({ children }: { children: React.ReactNode }) {
  const { session, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches and validates user roles from the server
   */
  const fetchAndValidateRoles = useCallback(async (userId: string, accessToken: string) => {
    try {
      const roles = await fetchUserRoles(userId, { accessToken });
      
      if (!Array.isArray(roles) || roles.length === 0) {
        logger.warn('No roles found for user, using default role');
        return [DEFAULT_ROLE];
      }
      
      // Filter out any invalid roles
      return roles.filter((role): role is UserRole => isValidRole(role));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch roles';
      const errorObj = new Error(errorMessage);
      logger.error('Error fetching user roles', { error: errorObj });
      throw errorObj;
    }
  }, []);

  /**
   * Gets the active role from localStorage if it's valid
   */
  const getValidActiveRole = useCallback((roles: UserRole[]): UserRole | null => {
    try {
      const storedRole = localStorage.getItem(ACTIVE_ROLE_KEY);
      if (storedRole && isValidRole(storedRole) && roles.includes(storedRole)) {
        return storedRole;
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      logger.warn('Error reading active role from localStorage', { error });
    }
    return null;
  }, []);

  /**
   * Initializes roles and active role
   */

  useEffect(() => {
    const hydrateRoles = async () => {
      if (isAuthLoading) return;

      setIsLoading(true);
      setError(null);

      if (!session) {
        logger.info('No session, setting default roles.');
        setRoles([DEFAULT_ROLE]);
        setActiveRole(DEFAULT_ROLE);
        setIsLoading(false);
        return;
      }

      try {
        const fetchedRoles = await fetchAndValidateRoles(session.user.id, session.access_token);
        const validActiveRole = getValidActiveRole(fetchedRoles);
        const highestRole = getHighestRole(fetchedRoles);
        const currentActiveRole = validActiveRole || highestRole;

        setRoles(fetchedRoles);
        setActiveRole(currentActiveRole);

        if (currentActiveRole) {
          localStorage.setItem(ACTIVE_ROLE_KEY, currentActiveRole);
        }
        logger.info('Roles hydrated successfully.', { userId: session.user.id, roles: fetchedRoles, activeRole: currentActiveRole });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('An unknown error occurred during role hydration');
        setError(error.message);
        setRoles([DEFAULT_ROLE]);
        setActiveRole(DEFAULT_ROLE);
        logger.error('Role hydration failed.', { error });
      } finally {
        setIsLoading(false);
      }
    };

    hydrateRoles();
  }, [session, isAuthLoading, fetchAndValidateRoles, getValidActiveRole]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md">
        <h3 className="font-medium">Error Loading Roles</h3>
        <p className="text-sm mt-1">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <RoleProvider 
      initialRoles={roles}
      initialActiveRole={activeRole}
      session={session}
    >
      {children}
    </RoleProvider>
  );
}

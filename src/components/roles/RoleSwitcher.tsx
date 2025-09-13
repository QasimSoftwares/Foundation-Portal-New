'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useRoleContext } from '@/components/roles/RoleProvider';
import type { UserRole } from '@/lib/security/roles';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  member: 'Member',
  volunteer: 'Volunteer',
  donor: 'Donor',
  viewer: 'Viewer',
};

// Global loading state
let globalRoleChangeInProgress = false;
const loadingSubscribers = new Set<(isLoading: boolean) => void>();

const LoadingOverlay = () => {
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-[9999] flex items-center justify-center transition-opacity duration-300 ease-in-out">
      <div className="flex flex-col items-center gap-4 p-8 bg-card rounded-xl shadow-2xl border animate-fade-in">
        <div className="relative">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-foreground">Switching Roles</p>
          <p className="text-muted-foreground max-w-md">Preparing your dashboard. This will just take a moment...</p>
        </div>
        <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <div className="h-full bg-primary/50 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export function RoleSwitcher() {
  const { activeRole, roles, setActiveRole } = useRoleContext();
  const router = useRouter();
  const pathname = usePathname();
  const [isSwitching, setIsSwitching] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Subscribe to global loading state
  useEffect(() => {
    const handleLoadingChange = (isLoading: boolean) => {
      if (isLoading) {
        setShowLoading(true);
      } else {
        setShowLoading(false);
      }
    };

    loadingSubscribers.add(handleLoadingChange);
    return () => {
      loadingSubscribers.delete(handleLoadingChange);
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, [loadingTimeout]);

  const updateGlobalLoading = (isLoading: boolean) => {
    globalRoleChangeInProgress = isLoading;
    loadingSubscribers.forEach(callback => callback(isLoading));
  };

  const handleRoleChange = async (role: UserRole) => {
    if (isSwitching || role === activeRole || globalRoleChangeInProgress) return;
    
    // Set loading states
    setIsSwitching(true);
    updateGlobalLoading(true);
    
    try {
      // Store the target role in session storage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pendingRole', role);
      }
      
      // Add a small delay to allow the UI to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set the new role in context
      setActiveRole(role);
      
      // Add a bit more delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Determine the target path based on role
      let targetPath = '/dashboard';
      switch(role) {
        case 'admin':
          targetPath = '/admin/dashboard';
          break;
        case 'donor':
          targetPath = '/donor/dashboard';
          break;
        case 'volunteer':
          targetPath = '/volunteer/dashboard';
          break;
        case 'member':
          targetPath = '/member/dashboard';
          break;
        case 'viewer':
          targetPath = '/dashboard';
          break;
        default:
          targetPath = '/dashboard';
      }
      
      // Store the active role in localStorage for the middleware
      localStorage.setItem('active-role', role);
      
      // Force a full page refresh to ensure clean state
      window.location.href = targetPath;
      
      // Fallback in case the redirect doesn't work
      const timeout = setTimeout(() => {
        window.location.reload();
      }, 1500);
      
      setLoadingTimeout(timeout as unknown as NodeJS.Timeout);
      
    } catch (error) {
      console.error('Error switching role:', error);
      // Clear loading states on error
      updateGlobalLoading(false);
      setIsSwitching(false);
      
      // Remove pending role on error
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pendingRole');
      }
    }
  };

  // Check for pending role on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pendingRole = sessionStorage.getItem('pendingRole') as UserRole | null;
      if (pendingRole && pendingRole !== activeRole) {
        // If we have a pending role that doesn't match current role, trigger a refresh
        sessionStorage.removeItem('pendingRole');
        window.location.reload();
      }
    }
  }, [activeRole]);

  if (!roles || roles.length === 0) {
    console.log('RoleSwitcher not rendered - no roles available');
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isSwitching}>
          <Button variant="outline" className="w-full justify-between">
            {isSwitching ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Switching...
              </span>
            ) : (
              <span className="capitalize">
                {activeRole ? ROLE_LABELS[activeRole] : 'Loading...'}
              </span>
            )}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-full">
          {roles.map((role) => (
            <DropdownMenuItem
              key={role}
              onClick={() => handleRoleChange(role)}
              className="capitalize"
              disabled={isSwitching || globalRoleChangeInProgress}
            >
              {ROLE_LABELS[role]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Global loading overlay */}
      {showLoading && createPortal(
        <LoadingOverlay />,
        document.body
      )}
    </>
  );
}

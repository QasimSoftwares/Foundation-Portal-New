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
const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  member: 'Member',
  volunteer: 'Volunteer',
  donor: 'Donor',
  viewer: 'Viewer',
};

export function RoleSwitcher() {
  const { activeRole, roles, setActiveRole } = useRoleContext();
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleRoleChange = async (role: UserRole) => {
    if (isSwitching || role === activeRole) return;

    setIsSwitching(true);

    try {
      // Call the provider to update the role on the server.
      // This now returns the dashboard path.
      const { dashboard } = await setActiveRole(role);

      // Use the Next.js router for a soft navigation.
      router.push(dashboard);

      // Refresh server components to get the new role state.
      router.refresh();

    } catch (error) {
      console.error('Error switching role:', error);
      // Optionally, show a toast notification on failure
    } finally {
      // It's often better to let the navigation complete before resetting this,
      // but for simplicity, we'll reset it here.
      // A more robust solution might use router events.
      setIsSwitching(false);
    }
  };

  if (!roles || roles.length <= 1) {
    return null; // Don't render the switcher if there's only one or zero roles
  }

  return (
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
              {activeRole ? ROLE_LABELS[activeRole] : 'Select Role'}
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
            disabled={isSwitching || role === activeRole}
          >
            {ROLE_LABELS[role]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

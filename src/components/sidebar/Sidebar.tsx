'use client';

import { SignOutButton } from '@/components/auth/sign-out-button';
import AdminSidebar from './AdminSidebar';
import NonAdminSidebar from './NonAdminSidebar';
import { RoleSwitcher } from '@/components/roles/RoleSwitcher';
import { useRoleContext } from '@/components/roles/RoleProvider';
import { ROLE_DASHBOARDS } from '@/config/routes';

export default function Sidebar() {
  const { activeRole, roles, loading } = useRoleContext();
  const currentRole = activeRole || 'viewer';
  const isAdminView = currentRole === 'admin';
  const dashboardPath = ROLE_DASHBOARDS[currentRole];

  console.log('Sidebar - Current state:', {
    activeRole,
    roles,
    loading,
    currentRole,
    isAdminView,
    dashboardPath
  });

  return (
    <aside className="w-64 border-r bg-white flex-shrink-0">
      <div className="flex h-full flex-col">
        <div className="h-4">
          {/* Minimal spacing at the top */}
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isAdminView ? (
            <AdminSidebar />
          ) : (
            <NonAdminSidebar role={currentRole} dashboardPath={dashboardPath} />
          )}
        </div>
        
        {/* Role switcher and sign out moved to top navigation */}
        <div className="border-t p-4">
          {/* Additional sidebar footer content can go here */}
        </div>
      </div>
    </aside>
  );
}
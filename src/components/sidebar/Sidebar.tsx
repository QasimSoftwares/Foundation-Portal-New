'use client';

import AdminSidebar from './AdminSidebar';
import NonAdminSidebar from './NonAdminSidebar';
import { useRoleContext } from '@/components/roles/RoleProvider';

export default function Sidebar() {
  const { activeRole, roles, loading } = useRoleContext();
  const currentRole = activeRole || 'viewer';
  const isAdminView = currentRole === 'admin';

  console.log('Sidebar - Current state:', {
    activeRole,
    roles,
    loading,
    currentRole,
    isAdminView
  });

  return (
    <aside className="fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-64 border-r bg-white flex-shrink-0 z-30">
      <div className="flex h-full flex-col">
        
        <div className="flex-1 overflow-y-auto py-2">
          {isAdminView ? (
            <AdminSidebar />
          ) : (
            <NonAdminSidebar role={currentRole} />
          )}
        </div>
        
        <div className="border-t p-4">
          <div className="text-xs text-gray-500">
            Family and Fellows Foundation
          </div>
        </div>
      </div>
    </aside>
  );
}
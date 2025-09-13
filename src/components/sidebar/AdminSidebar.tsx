"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, Users, Shield, Banknote, UserCheck, BarChart3 } from 'lucide-react';

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-4">
      <SidebarLink href="/admin/dashboard" icon={<Home className="h-5 w-5" />} active={pathname?.startsWith('/admin/dashboard')}>Dashboard</SidebarLink>
      <SidebarLink href="/admin/donors" icon={<Banknote className="h-5 w-5" />} active={pathname?.startsWith('/admin/donors')}>Donors</SidebarLink>
      <SidebarLink href="/admin/volunteers" icon={<UserCheck className="h-5 w-5" />} active={pathname?.startsWith('/admin/volunteers')}>Volunteers</SidebarLink>
      <SidebarLink href="/admin/members" icon={<Users className="h-5 w-5" />} active={pathname?.startsWith('/admin/members')}>Members</SidebarLink>
      <SidebarLink href="/admin/donations" icon={<Banknote className="h-5 w-5" />} active={pathname?.startsWith('/admin/donations')}>Donations</SidebarLink>
      <SidebarLink href="/admin/reports" icon={<BarChart3 className="h-5 w-5" />} active={pathname?.startsWith('/admin/reports')}>Reports</SidebarLink>
      <SidebarLink href="/admin/settings" icon={<Settings className="h-5 w-5" />} active={pathname?.startsWith('/admin/settings')}>Settings</SidebarLink>
      <div className="mt-4 border-t pt-4">
        <SidebarLink href="/admin/users" icon={<Users className="h-5 w-5" />} active={pathname?.startsWith('/admin/users')}>User Management</SidebarLink>
        <SidebarLink href="/admin/roles" icon={<Shield className="h-5 w-5" />} active={pathname?.startsWith('/admin/roles')}>Roles & Permissions</SidebarLink>
      </div>
    </nav>
  );
}

function SidebarLink({ href, icon, children, active }: { href: string; icon: React.ReactNode; children: React.ReactNode; active?: boolean }) {
  const base = "flex items-center px-6 py-3 transition-colors rounded-md mx-2";
  const colors = active
    ? "bg-blue-50 text-blue-700"
    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900";
  return (
    <Link href={href} className={`${base} ${colors}`}>
      <span className="mr-3">{icon}</span>
      <span>{children}</span>
    </Link>
  );
}

"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import type { UserRole } from '@/lib/security/roles';
import { sidebarConfig, type NavLink } from '@/config/sidebar';

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
}

interface NonAdminSidebarProps {
  role: UserRole;
}

export default function NonAdminSidebar({ role }: NonAdminSidebarProps) {
  const pathname = usePathname();
  const navLinks = sidebarConfig[role] || [];

  return (
    <nav className="flex-1 overflow-y-auto py-4 space-y-1">
      {navLinks.map((link: NavLink) => (
        <SidebarLink
          key={link.href}
          href={link.href}
          icon={link.icon}
          active={pathname?.startsWith(link.href)}
        >
          {link.label}
        </SidebarLink>
      ))}

      {/* "My Profile" link can be added here if it's common to all non-admin roles */}
      <div className="pt-4 mt-4 border-t border-gray-200">
        <SidebarLink
          href="/profile"
          icon={<User className="h-4 w-4" />}
          active={pathname?.startsWith('/profile')}
        >
          My Profile
        </SidebarLink>
      </div>
    </nav>
  );
}

function SidebarLink({ href, icon, children, active = false }: SidebarLinkProps) {
  const base = "flex items-center px-4 py-2 transition-colors rounded-md mx-2 text-sm font-medium";
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

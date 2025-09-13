"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, HeartHandshake, Users, Eye } from 'lucide-react';
import type { UserRole } from '@/lib/security/roles';

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
}

interface NonAdminSidebarProps {
  role: UserRole;
  dashboardPath: string;
}

export default function NonAdminSidebar({ role, dashboardPath }: NonAdminSidebarProps) {
  const pathname = usePathname();
  
  return (
    <nav className="flex-1 overflow-y-auto py-4">
      <SidebarLink 
        href={dashboardPath}
        icon={<Home className="h-5 w-5" />}
        active={pathname === dashboardPath}
      >
        Dashboard
      </SidebarLink>
      
      <SidebarLink 
        href="/profile" 
        icon={<User className="h-5 w-5" />}
        active={pathname?.startsWith('/profile')}
      >
        My Profile
      </SidebarLink>
      
      {role === 'member' && (
        <SidebarLink 
          href="/member" 
          icon={<Users className="h-5 w-5" />}
          active={pathname?.startsWith('/member')}
        >
          Member Area
        </SidebarLink>
      )}
      
      {role === 'volunteer' && (
        <SidebarLink 
          href="/volunteer" 
          icon={<Users className="h-5 w-5" />}
          active={pathname?.startsWith('/volunteer')}
        >
          Volunteer Portal
        </SidebarLink>
      )}
      
      {role === 'donor' && (
        <SidebarLink 
          href="/donor" 
          icon={<HeartHandshake className="h-5 w-5" />}
          active={pathname?.startsWith('/donor')}
        >
          Donor Portal
        </SidebarLink>
      )}
      
      {role === 'viewer' && (
        <SidebarLink 
          href="/learn-more" 
          icon={<Eye className="h-5 w-5" />}
          active={pathname?.startsWith('/learn-more')}
        >
          Learn More
        </SidebarLink>
      )}
    </nav>
  );
}

function SidebarLink({ href, icon, children, active = false }: SidebarLinkProps) {
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

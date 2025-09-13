'use client';

import { useState, useEffect, HTMLAttributes } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getRedirectPathForUser } from '@/lib/security/roles';

interface DashboardLinkProps extends Omit<HTMLAttributes<HTMLAnchorElement>, 'href'> {
  children: React.ReactNode;
}

export function DashboardLink({ children, className, ...props }: DashboardLinkProps) {
  const { session } = useAuth();
  const [dashboardUrl, setDashboardUrl] = useState('/dashboard'); // Default fallback

  useEffect(() => {
    if (session?.user?.id) {
      getRedirectPathForUser(session.user.id).then(path => {
        setDashboardUrl(path);
      }).catch(() => {
        // ignore and keep fallback
      });
    } else {
      setDashboardUrl('/dashboard');
    }
  }, [session?.user?.id]);

  return (
    <Link href={dashboardUrl} className={className} {...props}>
      {children}
    </Link>
  );
}

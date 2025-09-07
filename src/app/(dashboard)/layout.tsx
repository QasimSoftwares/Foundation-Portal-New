'use client';

import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import { Home, User, Settings, Loader2 } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';

const inter = Inter({ subsets: ['latin'] });

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-h-screen bg-gray-50', inter.className)}>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }>
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-white shadow-lg h-screen sticky top-0 flex flex-col">
            <div className="p-4 border-b">
              <h1 className="text-xl font-bold text-blue-600">FPN Portal</h1>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              <NavItem href="/dashboard" icon="dashboard">
                Dashboard
              </NavItem>
              <NavItem href="/profile" icon="user">
                My Profile
              </NavItem>
              <NavItem href="/settings" icon="settings">
                Settings
              </NavItem>
            </nav>
            <div className="p-4 border-t">
              <SignOutButton />
            </div>
          </aside>
          
          {/* Main content */}
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </Suspense>
      </div>
  );
}

// Helper component for navigation items
function NavItem({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  const getIcon = () => {
    switch (icon) {
      case 'dashboard':
        return <Home className="h-5 w-5" />;
      case 'user':
        return <User className="h-5 w-5" />;
      case 'settings':
        return <Settings className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <a
      href={href}
      className="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      <span className="mr-3">{getIcon()}</span>
      <span>{children}</span>
    </a>
  );
}

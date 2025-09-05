import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import { Home, User, Settings, Loader2 } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dashboard - FPN',
  description: 'FPN Dashboard',
};

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
        {/* Add your dashboard layout structure here */}
        <div className="flex">
          {/* Sidebar */}
          <aside className="w-64 bg-white shadow-lg h-screen sticky top-0">
            <div className="p-4">
              <h1 className="text-xl font-bold text-blue-600">FPN</h1>
            </div>
            <nav className="mt-6">
              <NavItem href="/dashboard" icon="dashboard">Dashboard</NavItem>
              <NavItem href="/profile" icon="user">Profile</NavItem>
              <NavItem href="/settings" icon="settings">Settings</NavItem>
            </nav>
          </aside>
          
          {/* Main content */}
          <main className="flex-1 p-8">
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

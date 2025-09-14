"use client";

import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/sidebar/Sidebar';
import TopNav from '@/components/nav/TopNav';
import { Loader2 } from 'lucide-react';

type PageLayoutProps = {
  children: ReactNode;
  /**
   * Page title to display in the layout
   */
  title?: string;
  /**
   * Whether to show the sidebar. Defaults to true.
   * Set to false for full-width pages like login.
   */
  showSidebar?: boolean;
  /**
   * Additional classes for the main content area
   */
  contentClassName?: string;
  /**
   * Whether the page requires authentication. Defaults to true.
   * If true, will show a loading state while checking auth.
   */
  requireAuth?: boolean;
};

export function PageLayout({
  children,
  title,
  showSidebar = true,
  contentClassName = '',
  requireAuth = true,
}: PageLayoutProps) {
  const { isLoading } = useAuth();

  // Show loading state while checking auth if required
  if (requireAuth && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex pt-14 h-[calc(100vh-3.5rem)]">
        {showSidebar && <Sidebar />}
        <main 
          className={`flex-1 overflow-y-auto ${contentClassName} ${
            showSidebar ? 'ml-64' : 'ml-0'
          }`}
        >
          <div className="p-4">
            {title && <h1 className="text-2xl font-bold mb-4">{title}</h1>}
            {children}
          </div>
        </main>
      </div>
    </div>

  );
}

// Helper function to combine class names
function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

'use client';

import React, { Suspense } from 'react';
import { Inter } from 'next/font/google';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import components to avoid SSR issues
const Sidebar = dynamic(() => import('@/components/sidebar/Sidebar'), { ssr: false });
const TopNav = dynamic(() => import('@/components/nav/TopNav'), { ssr: false });

// Create a cn utility function if it doesn't exist
const cn = (...classes: (string | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

const inter = Inter({ subsets: ['latin'] });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('min-h-screen bg-gray-50 flex flex-col', inter.className)}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        }
      >
        <TopNav />
        <div className="flex flex-1 overflow-hidden pt-14">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 md:ml-64">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </Suspense>
    </div>
  );
}

import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import Sidebar from '@/components/sidebar/Sidebar';
import TopNav from '@/components/nav/TopNav';

const inter = Inter({ subsets: ['latin'] });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
          <main className="flex-1 overflow-y-auto p-6 ml-64">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </Suspense>
    </div>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SupabaseProvider } from '@/components/providers/supabase-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { CSRFProvider } from '@/providers/CSRFProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FPN - Food Poverty Network',
  description: 'Food Poverty Network - Fighting hunger together',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <CSRFProvider>
          <SupabaseProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SupabaseProvider>
        </CSRFProvider>
      </body>
    </html>
  );
}
